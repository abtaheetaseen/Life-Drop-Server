const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")("sk_test_51PKiegRpw4vm6ovqL99cIbXx6C4wUpnD1iSEMKtZIpFVY2qZph0L2dLFKyLofl0raMACCgbRybv6Jz2FWzokiIXN00NyqpfOIH");
require('dotenv').config();

app.use(cors({
    origin: [
      "http://localhost:5173",
      "https://life-drop-6707c.web.app",
      "https://life-drop-6707c.firebaseapp.com",
    ]
  }));
app.use(express.json());

// mongo db
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.ofi7kql.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // database collections
    const userCollection = client.db("lifeDropDB").collection("users");
    const divisionCollection = client.db("lifeDropDB").collection("divisions");
    const districtCollection = client.db("lifeDropDB").collection("districts");
    const upazilaCollection = client.db("lifeDropDB").collection("upazilas");
    const donationRequestCollection = client.db("lifeDropDB").collection("donationRequests");
    const blogCollection = client.db("lifeDropDB").collection("blogs");
    const paymentCollection = client.db("lifeDropDB").collection("payments");

    // jwt api
    app.post("/jwt", async(req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "1d"
        })
        res.send({token});
    })

    // middlewares
    const verifyToken = (req, res, next) => {

        console.log("inside verify token", req.headers.authorization);

        if(!req.headers.authorization){
            return res.status(401).send({message: "Unauthorized Access"});
        }

        const token = req.headers.authorization.split(" ")[1];

        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
            if(error){
                return res.status(401).send({message: "Unauthorized Access"})
            }
            req.decoded = decoded;
            next();
        })
    }

    const verifyAdmin = async(req, res, next) => {
        const email = req.decoded.email;
        const query = {email: email};
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === "admin";
        if(!isAdmin){
            return res.status(403).send({message: "Forbidden Access"})
        }
        next();
    }

    const verifyVolunteer = async(req, res, next) => {
        const email = req.decoded.email;
        const query = {email: email};
        const user = await userCollection.findOne(query);
        const isVolunteer = user?.role === "volunteer";
        if(!isVolunteer){
            return res.status(403).send({message: "Forbidden Access"})
        }
        next();
    }

    // post user
    app.post("/users", async(req, res) => {
        const user = req.body;
        const existingEmail = await userCollection.findOne({email: user.email})
        if(existingEmail) {
            console.log("User already exist in db")
            return;
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
    })

    app.get("/allDonors", async(req, res) => {
        const result = await userCollection.find({role: "donor"}).toArray();
        res.send(result);
    })

    app.get("/user", verifyToken, verifyAdmin, async(req, res) => {
        console.log(req.query);
        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);
        const result = await userCollection.find().skip(page * size).limit(size).toArray();
        res.send(result);
    })

    app.get("/user/admin/:email", verifyToken, verifyAdmin, async(req, res) => {
        const email = req.params.email;
        if(email !== req.decoded.email){
            return res.status(401).send({message: "Forbidden Access"});
        }

        const query = {email: email};
        const user = await userCollection.findOne(query);
        let admin = false;
        if(user){
            admin = user?.role === "admin";
        }
        res.send({admin});
    })

    app.get("/user/volunteer/:email", verifyToken, verifyVolunteer, async(req, res) => {
        const email = req.params.email;
        if(email !== req.decoded.email){
            return res.status(401).send({message: "Forbidden Access"});
        }

        const query = {email: email};
        const user = await userCollection.findOne(query);
        let volunteer = false;
        if(user){
            volunteer = user?.role === "volunteer";
        }
        res.send({volunteer});
    })

    app.patch("/user/admin/make-volunteer/:id", verifyToken, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: "volunteer"
            }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/user/admin/make-admin/:id", verifyToken, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                role: "admin"
            }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/user/admin/block-user/:id", verifyToken, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: "blocked"
            }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/user/admin/unblock-user/:id", verifyToken, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: "active"
            }
        }
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    // get user by email
    app.get("/users", verifyToken, async(req, res) => {
        let query = {};
        if(req.query?.email){
            query = {email: req.query.email}
        }
        const result = await userCollection.findOne(query);
        res.send(result);
    })

    // update user
    app.put("/users/:id",  async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const options = { upsert: true };
        const updatedUser = req.body;
        const updatedDoc = {
            $set: {
                name: updatedUser.name,
                email: updatedUser.email,
                division: updatedUser.division,
                district: updatedUser.district,
                upazila: updatedUser.upazila,
                image_url: updatedUser.image_url,
                bloodGroup: updatedUser.bloodGroup
            }
        }

        const result = await userCollection.updateOne(filter, updatedDoc, options);
        res.send(result);
    })

    // user donation request
    app.post("/donationRequest", async(req, res) => {
        const donationRequest = req.body;
        const result = await donationRequestCollection.insertOne(donationRequest);
        res.send(result);
    })

    app.get("/donationRequest", async(req, res) => {
        
        console.log(req.query)
        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);

        let query = {};
        if(req.query?.email){
            query = {requesterEmail: req.query.email}
        }

        const cursor = donationRequestCollection.find(query).sort({"date": -1}).skip(page * size).limit(size);
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get("/allDonationRequestForVolunteer", verifyToken, verifyVolunteer, async(req, res) => {
        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);
        const result = await donationRequestCollection.find().skip(page * size).limit(size).toArray();
        res.send(result);
    })

    app.get("/donationRequests", verifyToken, verifyAdmin, async(req, res) => {
        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);
        const result = await donationRequestCollection.find().skip(page * size).limit(size).toArray();
        res.send(result);
    })

    app.put("/donationRequest/:id", verifyToken, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const options = { upsert: true };
        const updatedRequest = req.body;
        const updatedDoc = {
            $set: {
                requesterName: updatedRequest.requesterName,
                requesterEmail: updatedRequest.requesterEmail,
                recipientName: updatedRequest.recipientName,
                division: updatedRequest.division,
                district: updatedRequest.district,
                upazila: updatedRequest.upazila,
                bloodGroup: updatedRequest.bloodGroup,
                hospitalName: updatedRequest.hospitalName,
                fullAddress: updatedRequest.fullAddress,
                donationDate: updatedRequest.donationDate,
                donationTime: updatedRequest.donationTime,
                requestMessage: updatedRequest.requestMessage
            }
        }
        const result = await donationRequestCollection.updateOne(filter, updatedDoc, options);
        res.send(result);
    })

    app.patch("/donationRequest/:id", async(req, res) => {
        const id = req.params.id;
        console.log(id)
        const donorDetails = req.body;
        console.log(donorDetails);
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: "inProgress",
                donorName: donorDetails.donorName,
                donorEmail: donorDetails.donorEmail
            }
        }
        const result = await donationRequestCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/donationRequest/doneStatus/:id", verifyToken, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: "done"
            }
        }
        const result = await donationRequestCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.patch("/donationRequest/canceledStatus/:id", verifyToken, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: "canceled"
            }
        }
        const result = await donationRequestCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    app.delete("/donationRequest/:id", verifyToken, async(req, res) => {
        const id = req.params.id;
        const query = { _id : new ObjectId(id) };
        const result = await donationRequestCollection.deleteOne(query);
        res.send(result);
    })

    // get all divisions
    app.get("/divisions", async(req, res) => {
        const result = await divisionCollection.find().toArray();
        res.send(result);
    })

    // get all districts
    app.get("/districts", async(req, res) => {
        const result = await districtCollection.find().toArray();
        res.send(result);
    })

    // get all upazilas
    app.get("/upazilas", async(req, res) => {
        const result = await upazilaCollection.find().toArray();
        res.send(result);
    })

    // post blog
    app.post("/blogs", verifyToken, verifyAdmin, async(req, res) => {
        const blog = req.body;
        const result = await blogCollection.insertOne(blog);
        res.send(result);
    })

    app.get("/blogs", verifyToken, verifyAdmin, async(req, res) => {
        const result = await blogCollection.find().toArray();
        res.send(result);
    })

    app.delete("/blogs/:id", verifyToken, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await blogCollection.deleteOne(query);
        res.send(result);
    })

    app.patch("/blogs/publish/:id", verifyToken, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: "published"
            }
        }
        const result = await blogCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    
    app.post("/blog", verifyToken, verifyVolunteer, async(req, res) => {
        const blog = req.body;
        const result = await blogCollection.insertOne(blog);
        res.send(result);
    })

    // for volunteer
    app.get("/blog", verifyToken, verifyVolunteer, async(req, res) => {
        const result = await blogCollection.find().toArray();
        res.send(result);
    })

    app.patch("/blogs/draft/:id", verifyToken, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id) };
        const updatedDoc = {
            $set: {
                status: "draft"
            }
        }
        const result = await blogCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    // find published blog data
    app.get("/publishedBlogs", async(req, res) => {
        const result = await blogCollection.find({
            status: "published"
        }).toArray();
        res.send(result);
    })

    app.get("/publishedBlogs/:id", async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await blogCollection.findOne(query);
        res.send(result);
    })

    // find total count
    app.get("/totalUsersCount", verifyToken, verifyAdmin, async(req, res) => {
        const totalUsersCount = await userCollection.estimatedDocumentCount();
        res.send({totalUsersCount});
    })

    app.get("/totalPaymentCountForPagination", async(req, res) => {
        const totalPaymentCountForPagination = await paymentCollection.estimatedDocumentCount();
        res.send({totalPaymentCountForPagination});
    })

    app.get("/totalDonationRequestCount", verifyToken, async(req, res) => {
        const totalDonationRequestCount = await donationRequestCollection.estimatedDocumentCount();
        res.send({totalDonationRequestCount});
    })

    app.get("/totalDonationRequestCountUser", async(req, res) => {

        const email = req.query.email;
        const totalDonationRequestCountUser = await donationRequestCollection.countDocuments({requesterEmail: email});
        res.send({totalDonationRequestCountUser});
    })

    app.get("/admin-stats", verifyToken, verifyAdmin, async(req, res) => {
        const totalUsers = await userCollection.estimatedDocumentCount();
        const totalDonationRequests = await donationRequestCollection.estimatedDocumentCount();
        const funds = await paymentCollection.find().toArray();
        const revenue = funds.reduce((total, fund) => total + parseFloat(fund.amount), 0);

        res.send({totalUsers, totalDonationRequests, revenue});
    })

    // volunteer stats
    app.get("/volunteer-stats", verifyToken, verifyVolunteer, async(req, res) => {
        const totalUsers = await userCollection.estimatedDocumentCount();
        const totalDonationRequests = await donationRequestCollection.estimatedDocumentCount();
        const funds = await paymentCollection.find().toArray();
        const revenue = funds.reduce((total, fund) => total + parseFloat(fund.amount), 0);

        res.send({totalUsers, totalDonationRequests, revenue})
    })

    // insert fund ddetails
    app.post("/payment", async(req, res) => {
        const fundDetails = req.body;
        const result = await paymentCollection.insertOne(fundDetails);
        res.send(result);
    })

    app.get("/payment", async(req, res) => {
        console.log(req.query)
        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);
        const result = await paymentCollection.find().skip(page * size).limit(size).toArray();
        res.send(result);
    })

    // create payment-intent
    app.post("/create-payment-intent", async(req, res) => {
        const {price} = req.body;
        console.log(typeof price)
        if(price == 0){
            return;
        }
        const amount = parseInt(price * 100);
        console.log(amount, "inside the intent")

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ["card"]
        });
        console.log(paymentIntent);

        res.send({
            clientSecret: paymentIntent.client_secret
        });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('LIFE-DROP Server')
})

app.listen(port, () => {
  console.log(`server running on port ${port}`)
})