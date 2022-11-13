import express  from "express";
import cors from "cors";
import Joi from "joi";
import dayjs from "dayjs";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import { stripHtml } from "string-strip-html";

dotenv.config()

const app = express ();
app.use(cors());
app.use (express.json());

//conectando ao banco 
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;


mongoClient.connect().then(()=>{
  db = mongoClient.db(process.env.MONGO_DATABASE_NAME)
});

const participantsSchema = Joi.object({
  name: Joi.string().min(1).required(),
});

// rotas

// # PARTICIPANTS
app.post("/participants", async (req, res)=> {
  const {name} = req.body;

  const isValid = participantsSchema.validate({
    name: name,
  });
  const username = stripHtml(name).result
  
  if('error' in isValid) {
    return res.status(422).send()
  }
  try{
    const response = await db.collection("participants").findOne({
      name: username
    });

    if(response === null){
      const date = Date.now()
      db.collection("participants").insertOne({
        name:username, lastStatus: date,
      });
      db.collection("messages").insertOne(
        {
          from: username, 
          to: 'Todos', 
          text: 'entra na sala...', 
          type: 'status', 
          time: dayjs(date).format("HH:mm:ss"),
        }
      )
      return res.status(201).send()
    }else{
      return res.status(409).send()
    }
  }catch (err){
    return res.status(500).send()
  } 
})

app.get("/participants", async(req, res )=>{
  try {
    const participants = await db.collection("participants").find().toArray()
    res.send(participants);
  } catch (error) {
    res.status(500)
  }
});

// # MESSAGES
const valitationMessage = Joi.object({
  to : Joi.string().min(1).required(),
  text: Joi.string().min(1).required(),
  type: Joi.string().valid('message', 'private_message').required(),
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
    return res.status(422).send()
  }

  try {
    const response = await db.collection("participants").findOne({name:to})
    if(response !== null){
      db.collection("messages").insertOne({
          from: stripHtml(from).result.trim(), 
          to: stripHtml(to).result.trim(), 
          text: stripHtml(text).result.trim(), 
          type: stripHtml(type).result.trim(), 
          time: dayjs(Date.now()).format("HH:mm:ss"),
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

app.get("/messages", async (req, res)=>{
  const {limit}= req.query;
  const from = req.get("User");
  let limitMessages=0;
  if(limit){
    limitMessages=parseInt(limit);
  }
  try {
    const response = await db.collection("messages").find({
      from:from
    }).limit(limitMessages).toArray()
    res.send(response);
  } catch (error) {
    res.status(500).send();    
  }
})

app.post("/status", async (req, res)=>{
  const header= req.get("User")
  try {
    const response = await db.collection("participants").findOne({name:header})
    if(response!== null){
      await db.collection("participants").updateOne({_id:response._id},{$set:{lastStatus:Date.now()}})
      res.status(200).send();
    }else{
      res.status(404).send();
    }
    
  } catch (error) {
    
  }
})

let deletedParticipants = []
setInterval(async ()=> {
  const actualDate = new Date()
  const last10Seconds= new Date(actualDate.setSeconds(actualDate.getSeconds() - 10)).getTime();
  try {
    const response = await db.collection("participants").find({lastStatus:{
      $lte: last10Seconds
    }}).toArray();

    if(response.length > 0) {
      response.forEach(async(participant) => {
        await db.collection("participants").deleteOne({_id: participant._id});
        const message = {from: participant.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs(Date.now()).format("HH:mm:ss")}
        deletedParticipants.push(message);
        await db.collection("messages").insertOne(message);
      });
    }
  } catch (error) {
    console.log (error)
  }
},15000)

app.delete("/messages/:id", async(req, res)=>{
  const {id} = req.params
  const name= req.get("User")

  try {

    const message= await db.collection("messages").findOne({_id:ObjectId(id)});
    if(message!== null){
      const existsMessageUser= await db.collection("messages").findOne({_id:ObjectId(id), from: name});
      if(existsMessageUser !== null) {
        await db.collection("messages").deleteOne({_id:ObjectId(id), from: name});
        res.status(202).send();
      }else{
        res.status(401).send();
      }
    }else{
      res.status(404).send();
    }
  } catch (error) {
    console.log (error)
  }

})
app.listen (5000, () => console.log ("serve running import:5000") )
