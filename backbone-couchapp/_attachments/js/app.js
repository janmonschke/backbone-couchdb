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
	
	_.templateSettings = {
		interpolate : /\{\{(.+?)\}\}/g
	};
	
	// Let's start our mini comment App
	
	// The model for a comment is kinda simple.
	// We only need a name, a text and a date.
	var CommentModel = Backbone.Model.extend({
		initialize : function(){
			console.log("init");
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
	
	var EditView = Backbone.View.extend({
		el : $("#edit"),
		
		events : {
			"click #send" : "onSubmit"
		},
		
		initialize : function(){
			_.bindAll(this, "onSubmit");
			this.input = $("#send");
			
		},
		
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
	
	var EntryView = Backbone.View.extend({
		tagName : "tr",
		
		template : _.template($("#entry-template").html()),
		
		initialize : function(){
			_.bindAll(this, 'render');
			this.model.bind('change', this.render);
			//this.model.view = this;
			
		},
		
		render : function(){ 
			console.log("renderEntry",this.model.toJSON());
			var content = this.model.toJSON();

			$(this.el).html(this.template(content));
			return this;
		}
	});
	
	var CommentsTable = Backbone.View.extend({
		el: $("#comments"),
		
		initialize : function(){
			_.bindAll(this, 'refreshed', 'addRow');
			
			Comments.bind("refresh", this.refreshed);
			Comments.bind("add", this.addRow);

			Comments.fetch();
		},
		
		addRow : function(comment){
			var view = new EntryView({model: comment});
			var rendered = view.render().el;
			this.el.prepend(rendered);
		},
		
		refreshed : function(){
			if(Comments.length > 0){
				// reset the table
				this.$("#comments").html("<tr><td>Name</td><td>Text</td></tr>");
				// add each element
				Comments.each(this.addRow);
			}
		}
		
	});
	
	new EditView();
	new CommentsTable();

});