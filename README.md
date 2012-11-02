backbone-couchdb
================

This is a Backbone.js connector that overrides Backbone's default
sync-behavior and connects your app to your
[CouchDB](https://github.com/apache/couchdb) so that you can
[RELAX](http://vimeo.com/11852209) and don't need to worry about
(real-time) server-side code.

For a more detailed description head to [http://janmonschke.com/projects/backbone-couchdb.html](http://janmonschke.com/projects/backbone-couchdb.html).

Demos
-----
* [Real time chat](http://backbone.iriscouch.com/backbone-couchapp/_design/backbone_example/index.html) with support for private messages. (source in `/chat_example`)
* [Real time comments](http://backbone.iriscouch.com/backbone-couchapp/_design/backbone_couchapp_comments/index.html). (source in `/comments_example`)

Changelog
---------
* 1.3
  * Single global changes feed support to stay within the browser's concurrent connections per server limit [#25](https://github.com/janmonschke/backbone-couchdb/pull/25)

* 1.2.2
  * Revamped view options [#51](https://github.com/janmonschke/backbone-couchdb/pull/51)

* 1.2
  * CouchDB list support [#37](https://github.com/janmonschke/backbone-couchdb/pull/37)
  * Support for custom design documents for collections [#38](https://github.com/janmonschke/backbone-couchdb/pull/38)
  * Fix for views that emit `null` [#35](https://github.com/janmonschke/backbone-couchdb/pull/35)
  * A better way to test the library [/test](https://github.com/janmonschke/backbone-couchdb/tree/master/test)
  * more request information in error callbacks [#20](https://github.com/janmonschke/backbone-couchdb/issues/20#issuecomment-5461404)
  * Support for more options when fetching a collection [#34](https://github.com/janmonschke/backbone-couchdb/pull/34)
  * tested with Backbone 0.9.2

* 1.1
  * Fixed a bug with empty key param

* 1.0
  * CoffeeScript rewrite
  * Support for custom filter functions
  * Chat example (including tests)
  * Backbone 5.1 support
  * Various bugfixes
  * Started versioning ;)
