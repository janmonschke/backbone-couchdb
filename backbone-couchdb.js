/*
(c) 2011 Jan Monschke
v1.1
backbone-couchdb.js is licensed under the MIT license.
*/
var con,
  __hasProp = Object.prototype.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Backbone.couch_connector = con = {
  config: {
    db_name: "backbone_connect",
    ddoc_name: "backbone_example",
    view_name: "byCollection",
    global_changes: false,
    base_url: null
  },
  helpers: {
    extract_collection_name: function(model) {
      var _name, _splitted;
      if (model == null) throw new Error("No model has been passed");
      if (!(((model.collection != null) && (model.collection.url != null)) || (model.url != null))) {
        return "";
      }
      if (model.url != null) {
        _name = _.isFunction(model.url) ? model.url() : model.url;
      } else {
        _name = _.isFunction(model.collection.url) ? model.collection.url() : model.collection.url;
      }
      if (_name[0] === "/") _name = _name.slice(1, _name.length);
      _splitted = _name.split("/");
      _name = _splitted.length > 0 ? _splitted[0] : _name;
      _name = _name.replace("/", "");
      return _name;
    },
    make_db: function() {
      var db;
      db = $.couch.db(con.config.db_name);
      if (con.config.base_url != null) {
        db.uri = "" + con.config.base_url + "/" + con.config.db_name + "/";
      }
      return db;
    }
  },
  read: function(model, opts) {
    if (model.models) {
      return con.read_collection(model, opts);
    } else {
      return con.read_model(model, opts);
    }
  },
  read_collection: function(coll, opts) {
    var keys, _opts, _view,
      _this = this;
    _view = this.config.view_name;
    keys = [this.helpers.extract_collection_name(coll)];
    if (coll.db != null) {
      if (coll.db.changes || this.config.global_changes) coll.listen_to_changes();
      if (coll.db.view != null) _view = coll.db.view;
      if (coll.db.keys != null) keys = coll.db.keys;
    }
    _opts = {
      keys: keys,
      startkey: startkey,
      endkey: endkey,
      success: function(data) {
        var doc, _i, _len, _ref, _temp;
        _temp = [];
        _ref = data.rows;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          doc = _ref[_i];
          _temp.push(doc.value);
        }
        opts.success(_temp);
        return opts.complete();
      },
      error: function() {
        opts.error();
        return opts.complete();
      }
    };
    if ((coll.db != null) && (coll.db.view != null)) {
      if (!(coll.db.keys != null)) delete _opts.keys;
      if (!(coll.db.startkey != null)) {
        delete _opts.startkey;
        delete _opts.endkey;
      } else {
        delete _opts.key;
      }
      if (!(coll.db.endkey != null)) delete _opts.endkey;
    }
    return this.helpers.make_db().view("" + this.config.ddoc_name + "/" + _view, _opts);
  },
  read_model: function(model, opts) {
    if (!model.id) {
      throw new Error("The model has no id property, so it can't get fetched from the database");
    }
    return this.helpers.make_db().openDoc(model.id, {
      success: function(doc) {
        opts.success(doc);
        return opts.complete();
      },
      error: function() {
        opts.error();
        return opts.complete();
      }
    });
  },
  create: function(model, opts) {
    var coll, vals;
    vals = model.toJSON();
    coll = this.helpers.extract_collection_name(model);
    if (coll.length > 0) vals.collection = coll;
    return this.helpers.make_db().saveDoc(vals, {
      success: function(doc) {
        opts.success({
          _id: doc.id,
          _rev: doc.rev
        });
        return opts.complete();
      },
      error: function() {
        opts.error();
        return opts.complete();
      }
    });
  },
  update: function(model, opts) {
    return this.create(model, opts);
  },
  del: function(model, opts) {
    return this.helpers.make_db().removeDoc(model.toJSON(), {
      success: function() {
        return opts.success();
      },
      error: function(nr, req, e) {
        if (e === "deleted") {
          opts.success();
          return opts.complete();
        } else {
          opts.error();
          return opts.complete();
        }
      }
    });
  }
};

Backbone.sync = function(method, model, opts) {
  if (opts.success == null) opts.success = function() {};
  if (opts.error == null) opts.error = function() {};
  if (opts.complete == null) opts.complete = function() {};
  switch (method) {
    case "read":
      return con.read(model, opts);
    case "create":
      return con.create(model, opts);
    case "update":
      return con.update(model, opts);
    case "delete":
      return con.del(model, opts);
  }
};

Backbone.Model = (function(_super) {

  __extends(Model, _super);

  function Model() {
    Model.__super__.constructor.apply(this, arguments);
  }

  Model.prototype.idAttribute = "_id";

  Model.prototype.clone = function() {
    var new_model;
    new_model = new this.constructor(this);
    if (new_model.attributes._id) delete new_model.attributes._id;
    if (new_model.attributes._rev) delete new_model.attributes._rev;
    return new_model;
  };

  return Model;

})(Backbone.Model);

Backbone.Collection = (function(_super) {

  __extends(Collection, _super);

  function Collection() {
    this._db_on_change = __bind(this._db_on_change, this);
    this._db_prepared_for_changes = __bind(this._db_prepared_for_changes, this);
    Collection.__super__.constructor.apply(this, arguments);
  }

  Collection.prototype.model = Backbone.Model;

  Collection.prototype.initialize = function() {
    if (!this._db_changes_enabled && ((this.db && this.db.changes) || con.config.global_changes)) {
      return this.listen_to_changes();
    }
  };

  Collection.prototype.listen_to_changes = function() {
    if (!this._db_changes_enabled) {
      this._db_changes_enabled = true;
      if (!this._db_inst) this._db_inst = con.helpers.make_db();
      return this._db_inst.info({
        "success": this._db_prepared_for_changes
      });
    }
  };

  Collection.prototype.stop_changes = function() {
    this._db_changes_enabled = false;
    if (this._db_changes_handler != null) {
      this._db_changes_handler.stop();
      return this._db_changes_handler = null;
    }
  };

  Collection.prototype._db_prepared_for_changes = function(data) {
    var opts,
      _this = this;
    this._db_update_seq = data.update_seq || 0;
    opts = {
      include_docs: true,
      collection: con.helpers.extract_collection_name(this),
      filter: "" + con.config.ddoc_name + "/by_collection"
    };
    _.extend(opts, this.db);
    return _.defer(function() {
      _this._db_changes_handler = _this._db_inst.changes(_this._db_update_seq, opts);
      return _this._db_changes_handler.onChange(_this._db_on_change);
    });
  };

  Collection.prototype._db_on_change = function(changes) {
    var obj, _doc, _i, _len, _ref, _results;
    _ref = changes.results;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _doc = _ref[_i];
      obj = this.get(_doc.id);
      if (obj != null) {
        if (_doc.deleted) {
          _results.push(this.remove(obj));
        } else {
          if (obj.get("_rev") !== _doc.doc._rev) {
            _results.push(obj.set(_doc.doc));
          } else {
            _results.push(void 0);
          }
        }
      } else {
        if (!_doc.deleted) {
          _results.push(this.add(_doc.doc));
        } else {
          _results.push(void 0);
        }
      }
    }
    return _results;
  };

  return Collection;

})(Backbone.Collection);

Run
Link
Annotated Source

CoffeeScript is a little language that compiles into JavaScript. Underneath all those awkward braces and semicolons, JavaScript has always had a gorgeous object model at its heart. CoffeeScript is an attempt to expose the good parts of JavaScript in a simple way.

The golden rule of CoffeeScript is: "It's just JavaScript". The code compiles one-to-one into the equivalent JS, and there is no interpretation at runtime. You can use any existing JavaScript library seamlessly from CoffeeScript (and vice-versa). The compiled output is readable and pretty-printed, passes through JavaScript Lint without warnings, will work in every JavaScript implementation, and tends to run as fast or faster than the equivalent handwritten JavaScript.

Latest Version: 1.2.0
Overview

CoffeeScript on the left, compiled JavaScript output on the right.

# Assignment:
number   = 42
opposite = true

# Conditions:
number = -42 if opposite

# Functions:
square = (x) -> x * x

# Arrays:
list = [1, 2, 3, 4, 5]

# Objects:
math =
  root:   Math.sqrt
  square: square
  cube:   (x) -> x * square x

# Splats:
race = (winner, runners...) ->
  print winner, runners

# Existence:
alert "I knew it!" if elvis?

# Array comprehensions:
cubes = (math.cube num for num in list)

var cubes, list, math, num, number, opposite, race, square,
  __slice = Array.prototype.slice;

number = 42;

opposite = true;

if (opposite) number = -42;

square = function(x) {
  return x * x;
};

list = [1, 2, 3, 4, 5];

math = {
  root: Math.sqrt,
  square: square,
  cube: function(x) {
    return x * square(x);
  }
};

race = function() {
  var runners, winner;
  winner = arguments[0], runners = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
  return print(winner, runners);
};

if (typeof elvis !== "undefined" && elvis !== null) alert("I knew it!");

cubes = (function() {
  var _i, _len, _results;
  _results = [];
  for (_i = 0, _len = list.length; _i < _len; _i++) {
    num = list[_i];
    _results.push(math.cube(num));
  }
  return _results;
})();

run: cubes

Installation

The CoffeeScript compiler is itself written in CoffeeScript, using the Jison parser generator. The command-line version of coffee is available as a Node.js utility. The core compiler however, does not depend on Node, and can be run in any JavaScript environment, or in the browser (see "Try CoffeeScript", above).

To install, first make sure you have a working copy of the latest stable version of Node.js, and npm (the Node Package Manager). You can then install CoffeeScript with npm:

npm install -g coffee-script

(Leave off the -g if you don't wish to install globally.)

If you'd prefer to install the latest master version of CoffeeScript, you can clone the CoffeeScript source repository from GitHub, or download the source directly. To install the CoffeeScript compiler system-wide under /usr/local, open the directory and run:

sudo bin/cake install

If installing on Ubuntu or Debian, be careful not to use the existing out-of-date package.
Usage

Once installed, you should have access to the coffee command, which can execute scripts, compile .coffee files into .js, and provide an interactive REPL. The coffee command takes the following options:
-c, --compile 	Compile a .coffee script into a .js JavaScript file of the same name.
-i, --interactive 	Launch an interactive CoffeeScript session to try short snippets. 