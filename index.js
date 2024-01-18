import express from "express";
import bodyParser from "body-parser";
import { MongoClient } from "mongodb";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import { dirname } from "path";

const url = "http://localhost:3000/";

const openai = new OpenAI({
  apiKey: "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",
});

const assistId = "asst_iGSyxroyszEAfDtWXTWklRg0";

const app = express();

const uri =
  "mongodb+srv://123:123@ts.urop3ax.mongodb.net/?retryWrites=true&w=majority";

const mongoClient = new MongoClient(uri);

const dbName = "tallent-scope";
const collectionName = "accounts";

const clientPromise = mongoClient.connect();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static("public"));

async function getStatus(threadId, runId, callback) {
  const run = await openai.beta.threads.runs.retrieve(threadId, runId);
  const status = run.status;
  callback(status);
}

function checkStatus(
  threadId,
  runId,
  res,
  collection,
  email,
  pass,
  jobTitle,
  aboutTheEmployer,
  salary,
  remote,
  locationText,
  jobType,
  employmentType,
  description,
  requirements,
  keywords,
  skills,
  education,
  personality
) {
  getStatus(threadId, runId, async (status) => {
    if (status == "completed") {
      const threadMessages = await openai.beta.threads.messages.list(threadId);
      await collection.updateOne(
        { email: email, pass: pass },
        {
          $push: {
            chats: {
              jobTitle: jobTitle,
              aboutTheEmployer: aboutTheEmployer,
              salary: salary,
              remote: remote,
              locationText: locationText,
              jobType: jobType,
              employmentType: employmentType,
              description: description,
              requirements: requirements,
              keywords: keywords,
              skills: skills,
              education: education,
              personality: personality,
              assistantAnswer: threadMessages.data[0].content[0].text.value,
              date: new Date().toString(),
            },
          },
        }
      );
      res.send({ message: threadMessages.data[0].content[0].text.value });
    } else if (status == "in_progress") {
      setTimeout(
        () =>
          checkStatus(
            threadId,
            runId,
            res,
            collection,
            email,
            pass,
            jobTitle,
            aboutTheEmployer,
            salary,
            remote,
            locationText,
            jobType,
            employmentType,
            description,
            requirements,
            keywords,
            skills,
            education,
            personality
          ),
        1500
      );
    } else {
      console.log("error");
      res.send({ message: "error try again" });
    }
  });
}

async function contactAssistant(
  email,
  pass,
  jobTitle,
  aboutTheEmployer,
  salary,
  remote,
  locationText,
  jobType,
  employmentType,
  description,
  requirements,
  keywords,
  skills,
  education,
  personality,
  res,
  collection
) {
  const textToSend =
    "I want you to create a professional and detailed job description by using this information:" +
    (!jobTitle ? "" : " Job title: " + jobTitle + ";") +
    (!aboutTheEmployer
      ? ""
      : " About the employer: " + aboutTheEmployer + ";") +
    (!salary ? "" : " Salary: " + salary + ";") +
    (!remote ? "" : " Remote: " + remote + ";") +
    (!locationText ? "" : " Location: " + locationText + ";") +
    (!jobType ? "" : " Job type: " + jobType + ";") +
    (!employmentType ? "" : " Employment type: " + employmentType + ";") +
    (!description ? "" : " Description: " + description + ";") +
    (!requirements ? "" : " Requirements: " + requirements + ";") +
    (!keywords ? "" : " Keywords: " + keywords + ";") +
    (!skills ? "" : " Skills: " + skills + ";") +
    (!education ? "" : " Education: " + education + ";") +
    (!personality ? "" : " Personality: " + personality + ";") +
    " Give me just the job description and nothing else. Don't start the message with (Absolutely.....).";

  const run = await openai.beta.threads.createAndRun({
    assistant_id: assistId,
    thread: {
      messages: [
        {
          role: "user",
          content: textToSend,
        },
      ],
    },
  });

  await checkStatus(
    run.thread_id,
    run.id,
    res,
    collection,
    email,
    pass,
    jobTitle,
    aboutTheEmployer,
    salary,
    remote,
    locationText,
    jobType,
    employmentType,
    description,
    requirements,
    keywords,
    skills,
    education,
    personality
  );
}

app.get("/", async (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

app.post("/signUpSendData", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  const checkIfAccountExists = await collection.findOne({ email: email });

  if (!checkIfAccountExists) {
    await collection.insertOne({ email: email, pass: pass, chats: [] });
    res.send({ message: "account created" });
  } else {
    res.send({ message: "email taken" });
  }
});

app.post("/signInSendData", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  const verifyAcc = await collection.findOne({
    email: email,
    pass: pass,
  });

  if (verifyAcc) {
    res.send({ message: "account verifyed" });
  } else {
    res.send({ message: "wrong name or pass" });
  }
});

app.post("/sendData", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;
  const jobTitle = requestData.jobTitle;
  const aboutTheEmployer = requestData.aboutTheEmployer;
  const salary = requestData.salary;
  const remote = requestData.remote;
  const locationText = requestData.locationText;
  const jobType = requestData.jobType;
  const employmentType = requestData.employmentType;
  const description = requestData.description;
  const requirements = requestData.requirements;
  const keywords = requestData.keywords;
  const skills = requestData.skills;
  const education = requestData.education;
  const personality = requestData.personality;

  const checkIfAccountExists = await collection.findOne({
    email: email,
    pass: pass,
  });

  if (checkIfAccountExists) {
    await contactAssistant(
      email,
      pass,
      jobTitle,
      aboutTheEmployer,
      salary,
      remote,
      locationText,
      jobType,
      employmentType,
      description,
      requirements,
      keywords,
      skills,
      education,
      personality,
      res,
      collection
    );
  } else {
    res.send({ message: "account error" });
  }
});

app.post("/getHistory", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  const account = await collection.findOne({
    email: email,
    pass: pass,
  });

  if (account) {
    let historyArray = account.chats.slice(0, 9) || [];
    res.send({ message: JSON.stringify(historyArray) });
  } else {
    res.send({ message: "wrong name or pass" });
  }
});

app.post("/fPassSendData", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  let randomString = Array.from(
    { length: 30 },
    () => Math.random().toString(36)[2]
  ).join("");

  await collection.updateOne(
    {
      email: email,
    },
    { $set: { newPass: pass, resetKey: randomString } }
  );

  let emailLink = url + "updatePass/" + randomString + "/" + email;

  console.log(emailLink);

  res.send({ message: "ok" });
});

app.get("/updatePass/:key/:email", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const key = req.params.key;
  const email = req.params.email;

  let acc = await collection.findOne({
    email: email,
    resetKey: key,
  });

  const newPass = acc.newPass;

  if (key !== "" && key) {
    await collection.updateOne(
      {
        email: email,
        resetKey: key,
      },
      { $set: { newPass: "", resetKey: "", pass: newPass } }
    );

    res.sendFile("index.html", { root: __dirname });
  } else {
    res.send("error");
  }
});

app.listen(3000, () => {
  console.log(`Server is listening at ` + url);
});
