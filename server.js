const express = require("express")
const app = express()
const path = require("path")
if (process.env.NODE_ENV !== "production") { require("dotenv").config() }
const stripe = require("stripe")(process.env.STRIPE_PRIV_KEY)
app.use(require("body-parser").json())
const Airtable = require("airtable")
const db = new Airtable({apiKey: process.env.AIRTABLE_KEY}).base("appFhYtU2XMJZRS8e")

if (process.env.NODE_ENV === "production") {
  console.log("is production, serve statics")
  app.use(express.static(path.resolve(__dirname, "./build")));
  app.get("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, "./build/index.html"));
  });
  app.get("/.well-known/apple-developer-merchantid-domain-association", (req, res) => {
    res.sendFile(path.resolve(__dirname, "./.well-known/apple-developer-merchantid-domain-association"));
  });
}

app.post("/charge", async (req, res) => {
  console.log("got charge request")
  console.log(typeof req.body)
  console.dir(req.body)
  let now = new Date().toISOString()
  try {
    let charge = await stripe.charges.create({
      amount: Number(req.body.total) * 100,
      currency: "usd",
      description: `Order for ${req.body.customerName} on ${now}`,
      source: req.body.id
    })
    if (charge.paid) {
      const thisOrder = req.body.order
        .map(o => o.type === 'icecream' ?
          `${o.scoops} scoops of ${o.flavor} in a ${o.vessel}` :
          `${o.flavor} ${o.type}`)
      console.dir(thisOrder)
      return db("salt&straw").create({
        "Name": req.body.customerName,
        "Order": thisOrder.length > 1 ? thisOrder.reduce((a, b) => a.concat(`\n${b}`)) : thisOrder[0],
        "Order IN": now,
        "Total": req.body.total
      }, function (err, record) {
        if (err) {
          console.log('airtable error')
          console.error(err)
        }
        console.log('created an entry')
        console.dir(record)
        res.json({status: charge.status})
      })
    }
  } catch (err) {
    console.error(err)
    res.status(500).end();
  }
});
app.post("/receivePushSubscription", (req, res) => {
  console.log("receivePushSubscription on server")
  console.dir(req.body)
  db("salt&straw").update(req.body.orderId, { "Notify": req.body.subscription }, function (err, record) {
    if (err) {
      console.log('airtable error')
      console.error(err)
    } else {
      console.log('created an entry')
      console.dir(record)
      res.json({order: record})      
    }
  })
  // return database.orders.findOneAndUpdate({id: req.body.orderId}, {$set: {notify: req.body.subscription.endpoint}})
  // .then(order => res.json(order))
})
app.post("/handleOrderReady", (req, res) => {
  console.log(`handle order ready`)
  console.dir(req.body)
  let now = new Date().toISOString()
  return database.orders.findOneAndUpdate({id: req.body.orderId}, {$set: {order_out: now}})
  .then(order => {
    console.dir(order)
    console.log('dispatchPushNotification()')
    res.sendStatus(200)
  })
})
app.set("port", process.env.PORT || 8888)
app.listen(app.get("port"), () => console.log(`Listening on port ${app.get("port")}`));
