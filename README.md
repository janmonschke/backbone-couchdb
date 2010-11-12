backbone-couchdb
================

This is a Backbone connector that overrides the default sync-behavior and connects your Backbone app to your [CouchDB](https://github.com/apache/couchdb) so that you can [RELAX](http://vimeo.com/11852209) and don't need to worry about server-side code. 

Why a new connector?
--------------------

I developed this connector because I didn't want to write a whole new server that persists 
the models that Backbone.js creates. Instead of writing a server I now only have to write a simple design document
containing one simple view and I'm done with server-side code and can fully concentrate on my Backbone App.

Also I wanted to get real time updates when my models are changed on the server (e.g. by a second user). The CouchDB _changes feed seemed 
like a perfect match to me.

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

Give your [couchapp](https://github.com/couchapp/couchapp) some backbone
------------------------------------------------------------------------

An easy way to host single-page apps is to enclose them in a couchapp. I included a sample couchapp project to show you how to create 
couchapps with backbone and this CouchDB connector. Also there is a step by step tutorial located in the [readme of the couchapp](https://github.com/janmonschke/backbone-couchdb/blob/master/backbone-couchapp/README.md).

There is an instance of this couchapp running on [couchone](http://backbone.couchone.com/backbone-couchapp/_design/backbone-couchapp/index.html) and I uloaded a file with the [annotated source](http://janmonschke.github.com/backbone-couchdb/app.html) of the app. (Created with [docco](https://github.com/jashkenas/docco))

Dependencies
------------

* [Backbone.js](https://github.com/documentcloud/backbone) and therefore [Underscore.js](https://github.com/documentcloud/underscore)
* [jquery.couch.js](https://github.com/apache/couchdb/blob/trunk/share/www/script/jquery.couch.js) and therefore [jQuery](http://www.jquery.com/)


Learn more
----------

To show how backbone-couchdb works under the hood I created an annotated source file located [here](http://janmonschke.github.com/backbone-couchdb/backbone-couchdb.html).