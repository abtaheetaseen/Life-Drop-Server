const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
require('dotenv').config();

app.use(cors());
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

    app.get("/user", async(req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
    })

    app.patch("/user/admin/make-volunteer/:id", async(req, res) => {
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

    app.patch("/user/admin/make-admin/:id", async(req, res) => {
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

    // get user by email
    app.get("/users", async(req, res) => {
        let query = {};
        if(req.query?.email){
            query = {email: req.query.email}
        }
        const result = await userCollection.findOne(query);
        res.send(result);
    })

    app.put("/users/:id", async(req, res) => {
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