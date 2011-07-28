function(doc, req) {
  // only send notifications to the recipient
  if (doc.collection == "private_messages" && doc.to == req.userCtx.name)
    return true;
  else
    return false;
};