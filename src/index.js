import express  from "express";
import cors from "cors";
import Joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";

const app = express ();
app.use(cors());
app.use (express.json());

//conectando ao banco 
const mongoClient = new MongoClient("mongodb://localhost:27017/dbDuda");
let db;


mongoClient.connect().then(()=>{
  db = mongoClient.db("dbDuda")
});

const participantsSchema = Joi.object({
  name: Joi.string().min(1).required(),
});

app.post("/participants", async (req, res)=> {
  const {name} = req.body;

  const isValid = participantsSchema.validate({
    name: name,
  });

  if('error' in isValid) {
    return res.status(422).send({
      error: isValid.error
    })
  }

  try{
    const response = await db.collection("participants").findOne({
      name: name
    });
    if(response !== null){
      const date = Date().now()
      db.collection("participants").insertOne({
        name:name, lastStatus: date,
      });
      db.collection("messages").insertOne(
        {
          from: name, 
          to: 'Todos', 
          text: 'entra na sala...', 
          type: 'status', 
          time: dayjs(date).format("HH:MM:SS"),
        }
      )
    }else{
      res.status(409)
    }
  }catch (err){
    res.status(500)
  }

  res.status(201)
})

app.get("/participants",( req, res )=>{
  db.collection("participants").find().toArray().then( participants=>{
    console.log (participants);

  });
});

app.listen (5000, () => console.log ("serve running import:5000") )
