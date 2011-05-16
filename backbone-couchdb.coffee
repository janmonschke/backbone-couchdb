###
(c) 2011 Jan Monschke
backbone-couchdb.js is licensed under the MIT license.
###

Backbone.couch_connector = con =
  config : 
    db_name : "backbone_connect"
    ddoc_name : "backbone_example"
    view_name : "byCollection"
    global_changes : true
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
  
  _changes : 
    registered_collections : []
    registered_models : []
    handler : null
    _update_seq : null
    add : (coll) ->
      @registered_collections.push coll if @registered_collections.indexOf coll == -1
      @activate_changes() unless @handler?

    activate_changes : ->
      db = con.helpers.make_db()
      if _update_seq?
        @listen(db)
      else
        @prepare(db)
    
    prepare : (db) ->
      db.info
        success : (data) =>
          @_update_seq = data.update_seq || 0
          @listen db

    listen : (db) ->
      @handler = db.changes @_update_seq
      @handler.onChange (changes) =>
        console.log "change", changes
      
  read : (model, opts) ->
    if model.models 
      con.read_collection model, opts 
    else
      con.read_model model, opts

  ###
  Reads all docs of a collection based on the byCollection view or a custom view specified by the collection
  ###
  read_collection : (coll, opts) ->
    view = @config.view_name
    keys = [@helpers.extract_collection_name coll]
    if coll.db?
      @_changes.add coll if coll.db.changes or @config.global_changes
      view ?= coll.db.view
      #keys ?= coll.db.keys
    @helpers.make_db().view "#{@config.ddoc_name}/#{view}",
      keys : keys
      success : (data) ->
        if data.rows.length > 0
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

Backbone.sync = (method, model, opts) ->
  console.log "sync", arguments
  
  switch method
    when "read" then con.read model, opts
    when "create" then con.create model, opts
      
_.extend Backbone.Collection.prototype, 
  register_for_changes : ->
    con._changes.add @

_.extend Backbone.Model.prototype,
  # change the idAttribute since CouchDB uses _id
  idAttribute : "_id"
  register_for_changes : ->
    con._changes.add @