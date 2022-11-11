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
    if(response === null){
      const date = Date.now()
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
      return res.status(201).send()
    }else{
      return res.status(409).send({})
    }
  }catch (err){
    return res.status(500).send()
  } 
})

app.get("/participants", async( req, res )=>{
  try {
    const participants = await db.collection("participants").find().toArray()
    res.send(participants);
  } catch (error) {
    res.status(500)
  }
});

const valitationMessage = Joi.object({
  to : Joi.string().min(1).required(),
  text: Joi.string().min(1).required(),
  type: Joi.string().allow('message', 'private_message').required(),
  from: Joi.string().min(1).required(),
});


app.post("/messages", async (req, res) => {
  const {to, text,type} = req.body;
  const from = req.get("User");
  const isValid = valitationMessage.validate({
    to:to, 
    text:text,
    type:type,
    from:from,
  })

  if("error" in isValid){
    res.status(422);
  }

  try {
    const response = await db.collection("participants").findOne({name:to})
    if(response !== null){
      db.collection("messages").insertOne({
          from: from, 
          to: 'Todos', 
          text: 'entra na sala...', 
          type: 'status', 
          time: dayjs(Date.now()).format("HH:MM:SS"),
      })
      return res.status(201).send();
    }else{
      return res.status(422).send()
    }
  } catch (error) {
    console.log(error)
    return res.status(500).send()
  }
})

app.listen (5000, () => console.log ("serve running import:5000") )
