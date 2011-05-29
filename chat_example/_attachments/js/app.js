$(function(){
	// Fill this with your database information.
	// `ddocName` is the name of your couchapp project.
	Backbone.couch_connector.config.db_name = "backbone_connect";
	Backbone.couch_connector.config.ddoc_name = "backbone_example";
	Backbone.couch_connector.config.global_changes = "byCollection";
	// If set to true, the connector will listen to the changes feed
	// and will provide your models with real time remote updates.
	//Backbone.couchConnector.enableChanges = true;
	
	// Enables Mustache.js-like templating.
	_.templateSettings = {
		interpolate : /\{\{(.+?)\}\}/g
	};
	
	var UserModel = Backbone.Model.extend({
	  defaults : {
	    name : "Anonymus"
	  }
	});
	
	window.CurrentUser = new UserModel();
	
	// The model for a comment is kinda simple.
	// We only need a name, a text and a date.
	var MessageModel = Backbone.Model.extend({
		initialize : function(){
			if(!this.get("date")){
				this.set({"date": new Date().getTime()});
			}
		}
	});
	
	// Now let's define a new Collection of Comments
	var MessagesList = Backbone.Collection.extend({
	  db : {
	    view : "messages",
	    changes : true,
	    filter : Backbone.couch_connector.config.ddoc_name + "/messages"
	  },
		// The couchdb-connector is capable of mapping the url scheme
		// proposed by the authors of Backbone to documents in your database,
		// so that you don't have to change existing apps when you switch the sync-strategy
		url : "/messages",
		model : MessageModel,
		// The comments should be ordered by date
		comparator : function(comment){
			return comment.get("date");
		}
	});
	
	var Messages = new MessagesList();
	
	var PrivateMessage = MessageModel.extend({
	});
	
	var PrivateMessageList = Backbone.Collection.extend({
	  db : {
	    view : "none__",
	    changes : true,
	    filter : Backbone.couch_connector.config.ddoc_name + "/private_messages"
	  },
	  
	  url : "/private_messages",
	  
	  model : PrivateMessage,
	  
	  initialize : function(){
	    this.listen_to_changes();
	    that = this;
	    CurrentUser.bind("change:name", function(){
	      that.stop_changes();
	      that.listen_to_changes();
	    });
	  }
	});
	
	var PrivateMessages = new PrivateMessageList();
	
	var InputView = Backbone.View.extend({
	  el : $('#input'),
	  
	  regex : /@(\w+)/,
	  
	  events : {
	    "click #send" : "onSubmit"
	  },
	  
	  initialize : function(){
	    _.bindAll(this, "onSubmit", "nameChanged");
	    CurrentUser.bind("change:name", this.nameChanged);
	  },
	  
	  onSubmit : function(){
			var message = $("#message").val();
			console.log("submit", message);
			message = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
			if(message.length > 0){
			  var executed = this.regex.exec(message);
			  if(executed != null)
			    PrivateMessages.create({
			      "from" : CurrentUser.get("name"),
			      "to" : executed[1],
			      "message" : message.replace(executed[0], "")
			    });
			  else
          Messages.create({
            "from" : CurrentUser.get("name"),
            "message" : message
          });
			}
			$("#message").val("");
	  },
	  
	  nameChanged : function(){
	    console.log("name changed");
	    $('#name').text(CurrentUser.get('name'));
	  }
	});
	
	// Represents an comment entry
	var EntryView = Backbone.View.extend({
		tagName : "tr",
		
		template : _.template($("#entry-template").html()),
		
		// If there's a change in our model, rerender it
		initialize : function(){
			_.bindAll(this, 'render');
			this.model.bind('change', this.render);
			
		},
		
		render : function(){ 
			var content = this.model.toJSON();
			$(this.el).html(this.template(content));
			return this;
		}
	});
	
	var PrivateEntryView = EntryView.extend({
	  template : _.template($("#private-entry-template").html())
	});
	
	// The view for all comments
	var MessagesTable = Backbone.View.extend({
		el: $("#messages"),
		
		initialize : function(){
			_.bindAll(this, 'refreshed', 'addRow', 'addPrivateRow');
			
			Messages.bind("refresh", this.refreshed);
			Messages.bind("add", this.addRow);
			PrivateMessages.bind("add", this.addPrivateRow);
		},
		
		// Prepends an entry row 
		addRow : function(comment){
			var view = new EntryView({model: comment});
			var rendered = view.render().el;
			this.el.append(rendered);
		},
		
		addPrivateRow : function(private_message){
		  var view = new PrivateEntryView({model: private_message});
			var rendered = view.render().el;
			this.el.append(rendered);
		},
		
		// Renders all comments into the table
		refreshed : function(){
			// reset the table
			this.el.html("");
			if(Messages.length > 0){
				// add each element
				Messages.each(this.addRow);
			}
		}
		
	});
	
	// The App controller initializes the app by calling `Comments.fetch()`
	var App = Backbone.Controller.extend({
		initialize : function(){
			//Comments.fetch();
			//Comments.register_for_changes();
		}
	});
	
//new EditView();
//new CommentsTable();
$('#login').couchLogin({
  loggedIn : function(user){
    console.log("loggedn in", user)
    CurrentUser.set(user);
  },
  loggedOut : function(){
    CurrentUser.set(new UserModel().toJSON());
    CurrentUser.trigger("change:name");
  }
});
  new InputView();
  new MessagesTable();
  new App();

});