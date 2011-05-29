function(doc) {
  if (doc.collection == "messages") {
    emit(doc.collection, doc);
  }
};