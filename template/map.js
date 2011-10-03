function(doc) {
    if (doc.collection) {
        emit(doc.collection, doc);
    }
}
