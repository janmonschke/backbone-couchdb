###
(c) 2011 Jan Monschke
backbone-couchdb.js is licensed under the MIT license.
###

Backbone.couch_connector = con =
  config : 
    db_name : "backbone_connect"
    ddoc_name : "backbone_example"
    view_name : "byCollection"
    global_changes : false
    base_url : null
  
  helpers : 
    extract_collection_name : (model) ->
      throw new Error("No model has been passed") unless model?
      return "" unless ((model.collection? and model.collection.url?) or model.url?)
      if model.url?
        _name = if _.isFunction(model.url) then model.url() else model.url
      else
        _name = if _.isFunction(model.collection.url) then model.collection.url() else model.collection.url
      
      _name = _name.slice(1, _name.length) if _name[0] == "/"
      
      # jquery.couch.js adds the id itself, so we delete the id if it is in the url.
      # "collection/:id" -> "collection"
      _splitted = _name.split "/"
      _name = if _splitted.length > 0 then _splitted[0] else _name
      _name = _name.replace "/", ""
      _name
  
    make_db : ->
      db = $.couch.db con.config.db_name
      if con.config.base_url?
        db.uri = "#{con.config.base_url}/#{con.config.db_name}/";
      db
      
  read : (model, opts) ->
    if model.models 
      con.read_collection model, opts 
    else
      con.read_model model, opts

  ###
  Reads all docs of a collection based on the byCollection view or a custom view specified by the collection
  ###
  read_collection : (coll, opts) ->
    _view = @config.view_name
    keys = [@helpers.extract_collection_name coll]
    if coll.db?
      coll.listen_to_changes() if coll.db.changes or @config.global_changes
      if coll.db.view?
        _view = coll.db.view
        keys = coll.db.keys ? null

    @helpers.make_db().view "#{@config.ddoc_name}/#{_view}",
      keys : keys
      success : (data) =>
        _temp = []
        for doc in data.rows
          _temp.push doc.value
        opts.success _temp
      error : ->
        opts.error()

  read_model : (model, opts) ->
    throw new Error("The model has no id property, so I can't fetch it from the db") unless model.id
    @helpers.make_db().openDoc model.id,
      success : (doc) -> 
        opts.success(doc)
      error : ->
        opts.error()
  
  create : (model, opts) ->
    vals = model.toJSON()
    coll = @helpers.extract_collection_name model
    vals.collection = coll if coll.length > 0
    @helpers.make_db().saveDoc vals,
      success : (doc) ->
        opts.success
          _id : doc.id
          _rev : doc.rev
      error : ->
        opts.error()

  ### jquery.couch.js uses the same method for updating as it uses for creating a document, so we can use the `create` method here. ###
  update : (model, opts) ->
    @create(model, opts)

  del : (model, opts) ->
    @helpers.make_db().removeDoc model.toJSON(),
      success : ->
        opts.success()
      error : (nr, req, e) ->
        if e == "deleted"
          # The doc does no longer exist on the server
          opts.success()
        else
          opts.error()

Backbone.sync = (method, model, opts) ->
  switch method
    when "read" then con.read model, opts
    when "create" then con.create model, opts
    when "update" then con.update model, opts
    when "delete" then con.del model, opts
      
class Backbone.Collection extends Backbone.Collection
  initialize : ->
    @listen_to_changes() if !@_db_changes_enabled && (@db.changes or con.config.global_changes)

  listen_to_changes : ->
    unless @_db_changes_enabled # don't enable changes feed a second time
      @_db_changes_enabled = true
      @_db_inst = con.helpers.make_db() unless @_db_inst
      @_db_inst.info
        "success" : @_db_prepared_for_changes

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
      if obj? # test if collection contains the doc, if not, we add it to the collection
        if _doc.deleted # remove from collection if doc has been deleted on the server
          @remove obj 
        else
          obj.set _doc.doc unless obj.get("_rev") == _doc.doc._rev # set new values if _revs are not the same
      else
        @add _doc.doc if !_doc.deleted
      

class Backbone.Model extends Backbone.Model
  # change the idAttribute since CouchDB uses _id
  idAttribute : "_id"
  register_for_changes : ->
    con._changes.add @