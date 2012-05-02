backbone-couchdb
================

This is a Backbone.js connector that overrides Backbone's default
sync-behavior and connects your app to your
[CouchDB](https://github.com/apache/couchdb) so that you can
[RELAX](http://vimeo.com/11852209) and don't need to worry about
(real-time) server-side code.

Demos
-----
* [Real time chat](http://backbone.iriscouch.com/backbone-couchapp/_design/backbone_example/index.html) with support for private messages. (source in `/chat_example`)
* [Real time comments](http://backbone.iriscouch.com/backbone-couchapp/_design/backbone_couchapp_comments/index.html). (source in `/comments_example`)

Changelog
---------
* 1.2 (not yet released, still preparing)
  * CouchDB list support [#37](https://github.com/janmonschke/backbone-couchdb/pull/37)
  * Support for custom design documents for collections [#38](https://github.com/janmonschke/backbone-couchdb/pull/38)
  * Fix for views that emit `null` [#35](https://github.com/janmonschke/backbone-couchdb/pull/35)
  * A better way to test the library [/test](https://github.com/janmonschke/backbone-couchdb/tree/master/test)
  * more request information in error callbacks [#20](https://github.com/janmonschke/backbone-couchdb/issues/20#issuecomment-5461404)
  * Support for more options when fetching a collection [#34](https://github.com/janmonschke/backbone-couchdb/pull/34)

* 1.1
  * Fixed a bug with empty key param

* 1.0
  * CoffeeScript rewrite
  * Support for custom filter functions
  * Chat example (including tests)
  * Backbone 5.1 support
  * Various bugfixes
  * Started versioning ;)
  
Dependencies (already included in the examples)
------------

* [Backbone.js](https://github.com/documentcloud/backbone) (>= 0.5.1)
* [Underscore.js](https://github.com/documentcloud/underscore)
* [jquery.couch.js](https://github.com/daleharvey/jquery.couch.js)
* [jQuery](http://www.jquery.com/)

Why a new connector?
--------------------

I developed this connector because I didn't want to write a whole new
server that persists the models that Backbone.js creates. Instead of
writing a server you now only have to write a simple design document
containing one simple view and you're done with server-side code and can
fully concentrate on the Backbone App.

Also I wanted to get real time updates when my models are changed on the
server (e.g. by a second user). The CouchDB _changes feed seemed like a
perfect match for this problem.

Getting Started
---------------

All Backbone apps should work normally without any changes. Simply
include `backbone-couchdb.js` with its dependencies into your project
and configure the connector with your database infos.

    Backbone.couch_connector.config.db_name = "backbone-couchapp";
    Backbone.couch_connector.config.ddoc_name = "backbone-couchapp";
    Backbone.couch_connector.config.global_changes = false;
	
As you can see you also need to create a new database in your CouchDB
and a new design document that contains the following view called "byCollection":

    function(doc) {
        if (doc.collection) {
            emit(doc.collection, doc);
        }
    }

If you set `Backbone.couch_connector.config.global_changes` to true, the
connector will automatically update your models with remote changes in
near real time.

Give your [couchapp](https://github.com/couchapp/couchapp) some backbone
------------------------------------------------------------------------

An easy way to host single-page apps is to enclose them in a couchapp. I
included a sample couchapp project (`/chat_example`) to show you how to
create couchapps with Backbone and this CouchDB connector. You can also
use it as a bare couchapp directory structure for new projects.

There is an instance of this couchapp running on [iriscouch.com
(demo)](http://backbone.iriscouch.com/backbone-couchapp/_design/backbone_example/index.html)
and I uploaded a file with the [annotated
source](http://janmonschke.github.com/backbone-couchdb/app.html) of the
app. (Created with [docco](https://github.com/jashkenas/docco))

Erica support
-------------

[Erica](http://github.com/benoitc/erica) templates are supported. Simply
link the backbone-couchdb folder to ~/.erica/templates. Then you can
create an application using these templates:

    $ erica create template=backbone appid=myappname

Learn more
----------

To show how backbone-couchdb works under the hood I created an annotated
source file located
[here](http://janmonschke.github.com/backbone-couchdb/backbone-couchdb.html).
