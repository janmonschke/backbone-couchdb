###
(c) 2011 Jan Monschke
v1.1
backbone-couchdb.js is licensed under the MIT license.
###

Backbone.couch_connector = con =
  # some default config values for the database connections
  config : 
    db_name : "backbone_connect"
    ddoc_name : "backbone_example"
    view_name : "byCollection"
    list_name : null
    # if true, all Collections will have the _changes feed enabled
    global_changes : false
    # change the databse base_url to be able to fetch from a remote couchdb
    base_url : null
  
  # some helper methods for the connector
  helpers : 
    # returns a string representing the collection (needed for the "collection"-field)
    extract_collection_name : (model) ->
      throw new Error("No model has been passed") unless model?
      return "" unless ((model.collection? and model.collection.url?) or model.url?)
      if model.url?
        _name = if _.isFunction(model.url) then model.url() else model.url
      else
        _name = if _.isFunction(model.collection.url) then model.collection.url() else model.collection.url
      # remove the / at the beginning
      _name = _name.slice(1, _name.length) if _name[0] == "/"
      
      # jquery.couch.js adds the id itself, so we delete the id if it is in the url.
      # "collection/:id" -> "collection"
      _splitted = _name.split "/"
      _name = if _splitted.length > 0 then _splitted[0] else _name
      _name = _name.replace "/", ""
      _name
    
    # creates a database instance from the 
    make_db : ->
      db = $.couch.db con.config.db_name
      if con.config.base_url?
        db.uri = "#{con.config.base_url}/#{con.config.db_name}/";
      db
      
  # calls either the read method for collecions or models
  read : (model, opts) ->
    if model.models 
      con.read_collection model, opts 
    else
      con.read_model model, opts

  # Reads all docs of a collection based on the byCollection view or a custom view specified by the collection
  read_collection : (coll, opts) ->
    _view = @config.view_name
    _ddoc = @config.ddoc_name
    _list = @config.list_name
    keys = [@helpers.extract_collection_name coll]
    if coll.db?
      coll.listen_to_changes() if coll.db.changes or @config.global_changes
      if coll.db.view?
        _view = coll.db.view
      if coll.db.ddoc?
        _ddoc = coll.db.ddoc
      if coll.db.keys?
        keys = coll.db.keys 
      if coll.db.list?
        _list = coll.db.list
    
    _opts = 
      keys : keys
      success : (data) =>
        _temp = []
        for doc in data.rows
          if doc.value then _temp.push doc.value else _temp.push doc.doc
        opts.success _temp
        opts.complete()
      error : (status, error, reason) ->
        res = 
          status: status
          error: error
          reason: reason
        opts.error res
        opts.complete res

    # support view querying opts http://wiki.apache.org/couchdb/HTTP_view_API    

    view_options = [
      "key"
      "keys"
      "startkey"
      "startkey_docid"
      "endkey"
      "endkey_docid"
      "limit"
      "stale"
      "descending"
      "skip"
      "group"
      "group_level"
      "reduce"
      "include_docs"
      "inclusive_end"
      "update_seq"
    ]

    for option in view_options
      if opts[option]?
        _opts[option] = opts[option]

    # delete keys if a custom view is requested but no custom keys 
    if coll.db? and coll.db.view? and not coll.db.keys?
      delete _opts.keys
    
    if _list 
      @helpers.make_db().list "#{_ddoc}/#{_list}", "#{_view}", _opts   
    else
      @helpers.make_db().view "#{_ddoc}/#{_view}", _opts    


  # Reads a model from the couchdb by it's ID 
  read_model : (model, opts) ->
    throw new Error("The model has no id property, so it can't get fetched from the database") unless model.id
    @helpers.make_db().openDoc model.id,
      success : (doc) -> 
        opts.success(doc)
        opts.complete()
      error : (status, error, reason) ->
        res = 
          status: status
          error: error
          reason: reason
        opts.error res
        opts.complete res
  
  # Creates a model in the db
  create : (model, opts) ->
    vals = model.toJSON()
    coll = @helpers.extract_collection_name model
    vals.collection = coll if coll.length > 0
    @helpers.make_db().saveDoc vals,
      success : (doc) ->
        opts.success
          _id : doc.id
          _rev : doc.rev
        opts.complete()
      error : (status, error, reason) ->
        res = 
          status: status
          error: error
          reason: reason
        opts.error res
        opts.complete res

  # jquery.couch.js uses the same method for updating as it uses for creating a document, so we can use the `create` method here. ###
  update : (model, opts) ->
    @create(model, opts)

  # Deletes a model from the db
  del : (model, opts) ->
    @helpers.make_db().removeDoc model.toJSON(),
      success : ->
        opts.success()
      error : (nr, req, e) ->
        if e == "deleted"
          # The doc does no longer exist on the server
          opts.success()
          opts.complete()
        else
          res = 
            status: status
            error: error
            reason: reason
          opts.error res
          opts.complete res

# Overriding the sync method here to make the connector work ###
Backbone.sync = (method, model, opts) ->
  opts.success ?= ->
  opts.error ?= ->
  opts.complete ?= ->
  
  switch method
    when "read" then con.read model, opts
    when "create" then con.create model, opts
    when "update" then con.update model, opts
    when "delete" then con.del model, opts

class Backbone.Model extends Backbone.Model
  # change the idAttribute since CouchDB uses _id
  idAttribute : "_id"
  clone : ->
    new_model = new @constructor(@)
    # remove _id and _rev attributes on the cloned model object to have a **really** new, unsaved model object.
    # _id and _rev only exist on objects that have been saved, so check for existence is needed.
    delete new_model.attributes._id if new_model.attributes._id
    delete new_model.attributes._rev if new_model.attributes._rev
    new_model

# Adds some more methods to Collections that are needed for the connector ###
class Backbone.Collection extends Backbone.Collection
  model : Backbone.Model
  
  initialize : ->
    @listen_to_changes() if !@_db_changes_enabled && ((@db and @db.changes) or con.config.global_changes)

  # Manually start listening to real time updates
  listen_to_changes : ->
    # don't enable changes feed a second time
    unless @_db_changes_enabled
      @_db_changes_enabled = true
      @_db_inst = con.helpers.make_db() unless @_db_inst
      @_db_inst.info
        "success" : @_db_prepared_for_changes

  # Stop listening to real time updates
  stop_changes : ->
    @_db_changes_enabled = false
    if @_db_changes_handler?
      @_db_changes_handler.stop()
      @_db_changes_handler = null

  _db_prepared_for_changes : (data) =>
    @_db_update_seq = data.update_seq || 0
    opts = 
      include_docs : true
      collection : con.helpers.extract_collection_name(@)
      filter : "#{con.config.ddoc_name}/by_collection"
    _.extend opts, @db
    _.defer => 
      @_db_changes_handler = @_db_inst.changes(@_db_update_seq, opts)
      @_db_changes_handler.onChange @._db_on_change
    
  _db_on_change : (changes) =>
    for _doc in changes.results
      obj = @get _doc.id
      # test if collection contains the doc, if not, we add it to the collection
      if obj?
        # remove from collection if doc has been deleted on the server
        if _doc.deleted
          @remove obj
        else
          # set new values if _revs are not the same
          obj.set _doc.doc unless obj.get("_rev") == _doc.doc._rev 
      else
        @add _doc.doc if !_doc.deleted

