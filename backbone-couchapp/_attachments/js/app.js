$(function(){
	// Fill this with your database information.
	// `ddocName` is the name of your couchapp project.
	Backbone.couchConnector.databaseName = "backbone-couchapp";
	Backbone.couchConnector.ddocName = "backbone-couchapp";
	Backbone.couchConnector.viewName = "byCollection";
	// If set to true, the connector will listen to the changes feed
	// and will provide your models with real time remote updates.
	// THIS FEATURE IS IN DEVELOPMENT
	Backbone.couchConnector.enableChanges = false;
	
	// Enables Mustache.js-like templating.
	_.templateSettings = {
		interpolate : /\{\{(.+?)\}\}/g
	};
	
	// The model for a comment is kinda simple.
	// We only need a name, a text and a date.
	var CommentModel = Backbone.Model.extend({
		initialize : function(){
			if(!this.get("name")){
				this.set({"name": "Anonymus"});
			}
			if(!this.get("text")){
				this.set({"text": "Nothing"});
			}
			if(!this.get("date")){
				this.set({"date": new Date().getTime()});
			}
		}
	});
	
	// Now let's define a new Collection of Comments
	var CommentList = Backbone.Collection.extend({
		// The couchdb-connector is capable of mapping the url scheme
		// proposed by the authors of Backbone to documents in your database,
		// so that you don't have to change existing apps when you switch the sync-strategy
		url : "/comments",
		model : CommentModel,
		// The comments should be ordered by date
		comparator : function(comment){
			return comment.get("date");
		}
	});
	
	var Comments = new CommentList();
	
	// This view is responsible for creating the Comment fields.
	var EditView = Backbone.View.extend({
		el : $("#edit"),
		
		events : {
			"click #send" : "onSubmit"
		},
		
		initialize : function(){
			_.bindAll(this, "onSubmit");
		},
		
		// Simply takes the vals from the input fields and 
		// creates a new Comment.
		onSubmit : function(){
			var name = $("#name").val();
			var text = $("#text").val();
			Comments.create({
				"name" : name,
				"text" : text,
				"date" : new Date().getTime()
			});
		}
	});
	
	// Represents an comment entry
	var EntryView = Backbone.View.extend({
		tagName : "tr",
		
		template : _.template($("#entry-template").html()),
		
		// Clicking the `X` leads to a deletion
		events : {
			"click .delete" : "deleteMe"
		},
		
		// If there's a change in our model, rerender it
		initialize : function(){
			_.bindAll(this, 'render', 'deleteMe');
			this.model.bind('change', this.render);
		},
		
		render : function(){ 
			var content = this.model.toJSON();
			$(this.el).html(this.template(content));
			return this;
		},
		
		// Fade out the element and destroy the model
		deleteMe : function(){
			this.model.destroy();
			$(this.el).fadeOut("fast",function(){
				$(this).remove();
			});
		}
	});
	
	// The view for all comments
	var CommentsTable = Backbone.View.extend({
		el: $("#comments"),
		
		initialize : function(){
			_.bindAll(this, 'refreshed', 'addRow');
			
			Comments.bind("refresh", this.refreshed);
			Comments.bind("add", this.addRow);
		},
		
		// Prepends an entry row 
		addRow : function(comment){
			var view = new EntryView({model: comment});
			var rendered = view.render().el;
			this.el.prepend(rendered);
		},
		
		// Renders all comments into the table
		refreshed : function(){
			if(Comments.length > 0){
				// reset the table
				$("#comments").html("");
				// add each element
				Comments.each(this.addRow);
			}
		}
		
	});
	
	// The App controller initializes the app by calling `Comments.fetch()`
	var App = Backbone.Controller.extend({
		initialize : function(){
			Comments.fetch();
		}
	});
	
	new EditView();
	new CommentsTable();
	new App();

});