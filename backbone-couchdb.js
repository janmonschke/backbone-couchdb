// I developed this connector because I didn't want to write an own server that persists 
// the models that Backbone.js ceated. Instead I now only have to write a simple design document 
// containing one simple view and I'm done with server-side code. 
// So have fun reading the doc and [RELAX](http://vimeo.com/11852209) :D

// I added the connector to the Backbone object.
Backbone.couchConnector = {
	// Name of the Database.
	databaseName : "test1",
	// Name of the design document that contains the views.
	ddocName : "backbone",
	// Name of the view.
	viewName : "byCollection",
	enableChanges : false,
	// If `baseUrl` is set, the default uri of jquery.couch.js will be overridden.
	// This is useful if you want to access a couch on another server e.g. `http://127.0.0.1:5984`
	// Important: Be aware of the Cross-Origin Policy. 
	baseUrl : null,
	// A simple lookup table for collections that should be synched.
	_watchList : [],
	getCollectionFromModel : function(model){
		// I would like to use the Backbone `getUrl()` helper here but it's not in my scope.
		if (!(model && model.url)) 
			throw new Error("No url property/function!");
		var collectionName = _.isFunction(model.url) ? model.url() : model.url;
		collectionName = collectionName.replace("/","");
		var split = collectionName.split("/");
		// jquery.couch.js adds the id itself, so we delete the id if it is in the url.
		// "collection/:id" -> "collection"
		if(split.length > 1){
			collectionName = split[0];
		}
		return collectionName;
	},
	// Creates a couchDB object from the given model object.
	makeDb : function(model){
		var db = $.couch.db(this.databaseName);
		if(this.baseUrl){
			db.uri = this.baseUrl + "/" + this.databaseName + "/";
		}
		return db;
	},
	// Fetches all docs from the given collection.
	// Therefore all docs from the view `ddocName`/`viewName` will be requested.
	// A simple view could look like this:
	// function(doc) {
	// 	if(doc.collection) 
	//		emit(doc.collection, doc);
	// }
	// doc.collection represents the url property of the collection.
	read : function(coll, _success, _error){
		var db = this.makeDb(coll);
		var collection = this.getCollectionFromModel(coll);
		var query = this.ddocName + "/" + this.viewName;
		// Query equals ddocName/viewName 
		db.view(query,{
			// Only return docs that have this collection's name as key.
			keys : [collection],
			include_docs:true,
			success:function(result){
				if(result.rows.length > 0){
					var arr = [];
					// Prepare the result set for Backbon -> Only return the docs and no meta data.
					for (var i=0; i < result.rows.length; i++) {
						arr.push(result.rows[i].doc);
					}
					_success(arr);
				}else{
					_success(null);
				}
			},
			error: _error
		});
		// Add the collection to the `_watchlist`.
		if(!this._watchList[collection]){
			this._watchList[collection] = coll;			
		}

	},
	// Creates a document.
	create : function(model, _success, _error){
		var db = this.makeDb(model);
		var data = model.toJSON();
		if(!data.collection){
			data.collection = this.getCollectionFromModel(model);
		}
		if(!data.id && data._id){
			data.id = data._id;
		}
		// jquery.couch.js automatically finds out whether the document is new 
		// or already exists by checking for the _id property.
		db.saveDoc(data,{
			success : function(resp){
				// When the document has been successfully created/altered, return
				// the created/changed values. Backbone finds out that an element has been
				// synched by checking for the existance of an `id` property in the model.
				// By returning the an object with an `id` we mark the model as synched.
				if(model.id)
					_success({
						"_id" : resp.id,
						"_rev" : resp.rev
					});
				else
					_success({
						"id" : resp.id,
						"_id" : resp.id,
						"_rev" : resp.rev
					});
			},
			error : _error
		});
	},
	// jquery.couch.js provides the same method for updating and creating a document, 
	// so we can use the `create` method here.
	update : function(model, _success, _error){
		this.create(model, _success, _error);
	},
	// Deletes the document via the removeDoc method.
	delete : function(model, _success, _error){
		var db = this.makeDb(model);
		var data = model.toJSON();
		db.removeDoc(data,{
			success: function(){
				_success();
			},
			error: _error
		});
	},
	// The _changes feed is one of the coolest things about CouchDB in my opinion.
	// It enables you to get real time updates of changes in your database.
	// If `enableChanges` is true the connector automatically listens to changes in the database 
	// and updates the changed models. -> Remotely triggered `change` events in your models. YES!
	_changes : function(model){
		var db = this.makeDb(model);
		var connector = this;
		// First grab the `update_seq` from the database info, so that we only receive newest changes.
		db.info({
			success : function(data){
				var since = (data.update_seq || 0)
				// Connect to the changes feed.
				connector.changesFeed = db.changes(since,{include_docs:true});
				connector.changesFeed.onChange(function(changes){
					console.log("changes: ", changes);
					var doc,coll,model;
					// Iterate over the changed docs and validate them.
					for (var i=0; i < changes.results.length; i++) {
						doc = changes.results[i].doc;
						if(doc.collection){
							coll = connector._watchList[doc.collection];
							if(coll){
								model = coll.get(doc.id);
								if(model){
									// Currently all properties are updated, will diff in the future.
									model.set(doc);
								}else{
									//EXPERIMENTAL, WILL BREAK ^^
									coll.create(doc);
								}
							}
						}
					}
				});
			}
		});
	}
};

// Override the standard sync method.
Backbone.sync = function(method, model, success, error) {
	
	if(method == "create" || method == "update"){
		Backbone.couchConnector.create(model,success,error);
	}else if(method == "read"){
		Backbone.couchConnector.read(model,success,error);
	}else if(method == "delete"){
		Backbone.couchConnector.delete(model,success,error);
	}
	
	// Activate real time changes feed
	if(Backbone.couchConnector.enableChanges && !Backbone.couchConnector.changesFeed){
		Backbone.couchConnector._changes(model);
	}	
}