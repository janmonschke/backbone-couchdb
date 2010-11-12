backbone-couchdb
================

This is a Backbone connector that overrides the default sync-behavior and connects to your Backbone app to a CouchDB 
of your choice.
 
I developed this connector because I didn't want to write a whole new server that persists 
the models that Backbone.js created. Instead of writing a server I now only have to write a simple design document
containing one simple view and I'm done with server-side code and can fully concentrate on my Backbone App.

Also I wanted to get real time updates when my models are changed on the server (e.g. by a second user). The CouchDB _changes feed seemed 
like a perfect match to me.
 
Have fun reading the docs, checkout the [example couchapp](http://backbone.couchone.com/backbone-couchapp/_design/backbone-couchapp/index.html) and [RELAX](http://vimeo.com/11852209) :D

Getting Started
---------------

All Backbone apps should work normally without any changes. Simply include `backbone-couchdb.js` with its dependencies into your project and configure the connector with your database infos.

	Backbone.couchConnector.databaseName = "backbone-couchapp";
	Backbone.couchConnector.ddocName = "backbone-couchapp";
	Backbone.couchConnector.viewName = "byCollection";
	Backbone.couchConnector.enableChanges = true;
	
As you can see you also need to create a new database in your CouchDB and a new design document that contains the following view:

    function(doc) {
        if (doc.collection) {
            emit(doc.collection, doc);
        }
    }

If you set `Backbone.couchConnector.enableChanges` to true, the connector will update your models with remote changes in near real time.

Give your couchapp some backbone
--------------------------------

bla

Dependencies
------------

blubb
