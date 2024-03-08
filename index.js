import express from "express";
import bodyParser from "body-parser";
import { MongoClient } from "mongodb";
import OpenAI from "openai";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { jsPDF } from "jspdf";
import * as postmark from "postmark";
import cors from "cors";
import { config } from "dotenv";
config();
const { STRIPE_PRIVATE_KEY, STRIPE_PRICE_ID, CLIENT_URL, APP_PORT } =
  process.env;

// const url = "http://35.175.226.121:80/";
const url = CLIENT_URL + "/";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

const assistId = "asst_iGSyxroyszEAfDtWXTWklRg0";

const app = express();

app.use(cors({ origin: true }));

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

const postmarkServerToken = "082416e9-c744-445e-ad00-82a61409bc8c";
const client = new postmark.ServerClient(postmarkServerToken);

const stripePromise = import("stripe");

let stripe = 0;

stripePromise.then((module) => {
  stripe = module.default(STRIPE_PRIVATE_KEY);
});

async function getStatus(threadId, runId, callback) {
  const run = await openai.beta.threads.runs.retrieve(threadId, runId);
  const status = run.status;
  callback(status);
}

async function verifyPay(collection, email, pass, spend) {
  const user = await collection.findOne({ email: email, pass: pass });

  if (user) {
    if (user.freeTokens > 0) {
      if (spend) {
        await collection.updateOne(
          { email: email, pass: pass },
          { $set: { freeTokens: user.freeTokens - 1 } }
        );
      }
      return true;
    } else {
      if (!user.stripeSessionId) {
        return false;
      }

      console.log(111);

      try {
        const session = await stripe.checkout.sessions.retrieve(
          user.stripeSessionId
        );

        console.log(session.status);

        if (
          session &&
          session.status === "complete" &&
          session.payment_status === "paid"
        ) {
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.error(
          "An error occurred while retrieving the Stripe session:",
          error
        );
        return false;
      }
    }
  } else {
    return false;
  }
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
  personality,
  lang
) {
  getStatus(threadId, runId, async (status) => {
    if (status == "completed") {
      const threadMessages = await openai.beta.threads.messages.list(threadId);

      let databaseNumber = await collection.findOne({
        email: email,
        pass: pass,
      });

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
              lang: lang,
            },
          },
        }
      );
      res.send({
        message: threadMessages.data[0].content[0].text.value,
        databaseNumber: databaseNumber.chats.length,
      });
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
            personality,
            lang
          ),
        1500
      );
    } else {
      console.log(status);
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
  collection,
  lang
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
    (!lang ? "" : " The whole output should be in " + lang + "!!!") +
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
    personality,
    lang
  );
}

function formatString(inputString, maxLineLength) {
  const lines = inputString.split("\n");

  const formattedLines = lines.map((line) => {
    const words = line.split(/\s+/);
    let currentLine = "";

    const formattedLine = words.reduce((result, word) => {
      if ((currentLine + word).length > maxLineLength) {
        result += currentLine.trim() + "\n";
        currentLine = "";
      }
      currentLine += word + " ";
      return result;
    }, "");

    return formattedLine + currentLine.trim();
  });

  return formattedLines.join("\n");
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

  try {
    const checkIfAccountExists = await collection.findOne({ email: email });

    if (!checkIfAccountExists) {
      await collection.insertOne({
        email: email,
        pass: pass,
        chats: [],
        freeTokens: 3,
      });
      res.send({ message: "account created" });
    } else {
      res.send({ message: "email taken" });
    }
  } catch (e) {
    res.send("error");
  }
});

app.post("/signInSendData", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  try {
    const verifyAcc = await collection.findOne({
      email: email,
      pass: pass,
    });

    if (verifyAcc) {
      res.send({ message: "account verifyed" });
    } else {
      res.send({ message: "wrong name or pass" });
    }
  } catch (e) {
    res.send("error");
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
  const lang = requestData.lang;

  const verified = await verifyPay(collection, email, pass, true);

  if (!verified) {
    res.send({ message: "not payed" });
  } else {
    try {
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
          collection,
          lang
        );
      } else {
        res.send({ message: "account error" });
      }
    } catch (e) {
      res.send("error");
    }
  }
});

app.post("/getHistory", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  const verified = await verifyPay(collection, email, pass, false);

  if (!verified) {
    res.send({ message: "not payed" });
  } else {
    try {
      const account = await collection.findOne({
        email: email,
        pass: pass,
      });

      if (account) {
        account.chats.forEach((obj, index) => {
          obj.id = index;
        });
        let historyArray = account.chats.slice(-10) || [];
        res.send({ message: JSON.stringify(historyArray) });
        return;
      } else {
        res.send({ message: "wrong name or pass" });
        return;
      }
    } catch (e) {
      res.send("error");
    }
  }
});

app.post("/fPassSendData", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  try {
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

    client.sendEmail({
      From: "hello@writenhire.ai",
      To: email,
      Subject: "Reset password",
      TextBody: "Reset password: " + emailLink,
    });

    res.send({ message: "ok" });
  } catch (e) {
    res.send("error");
  }
});

app.get("/updatePass/:key/:email", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const key = req.params.key;
  const email = req.params.email;

  try {
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

      res.redirect(CLIENT_URL);
    } else {
      res.send("invalid key");
    }
  } catch (e) {
    res.send("error");
  }
});

app.post("/pdf", (req, res) => {
  const requestData = req.body;
  try {
    const doc = new jsPDF();

    const lines = formatString(requestData.data, 65).split("\n");
    for (let i = 0; i < lines.length; i += 40) {
      const chunk = lines.slice(i, i + 40).join("\n");
      if (i !== 0) {
        doc.addPage();
      }
      doc.text(chunk, 10, 10);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=a4.pdf");

    res.send(doc.output());
  } catch (e) {
    res.send("error");
  }
});

app.post("/updateText", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;
  const newText = requestData.newText;
  const currentTextDbId = requestData.currentTextDbId;

  const verified = await verifyPay(collection, email, pass, false);

  if (!verified) {
    res.send({ message: "not payed" });
  } else {
    try {
      await collection.updateOne(
        {
          email: email,
          pass: pass,
        },
        { $set: { [`chats.${currentTextDbId}.assistantAnswer`]: newText } }
      );

      res.send({ message: "ok" });
    } catch (e) {
      res.send({ message: "error" });
    }
  }
});

app.post("/validate", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  const verified = await verifyPay(collection, email, pass, false);

  if (!verified) {
    res.send({ message: "not payed" });
  } else {
    res.send({ message: "ok" });
  }
});

const quantity = 29;

app.post("/create-checkout-session", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);
  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  const verified = await verifyPay(collection, email, pass, false);

  if (!verified) {
    try {
      const session = await stripe.checkout.sessions.create({
        success_url: `${CLIENT_URL}`,
        cancel_url: `${CLIENT_URL}`,
        line_items: [
          {
            price: STRIPE_PRICE_ID,
            quantity: quantity,
          },
        ],
        mode: "subscription",
      });
      // console.log("session: ", session.id, session.url, session);

      // get id, save to user, return url
      const sessionId = session.id;
      console.log("sessionId: ", sessionId);

      // save session.id to the user in your database
      await collection.updateOne(
        { email: email, pass: pass },
        { $set: { stripeSessionId: sessionId } }
      );

      console.log({ email: email, pass: pass });

      res.json({ url: session.url });
    } catch (e) {
      // console.log(e)
      res.status(500).json({ error: e.message });
    }
  } else {
    res.send({ message: "already paid" });
  }
});

const quantity2 = 39;

app.post("/create-checkout-session2", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);
  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  const verified = await verifyPay(collection, email, pass, false);

  if (!verified) {
    try {
      const session = await stripe.checkout.sessions.create({
        success_url: `${CLIENT_URL}`,
        cancel_url: `${CLIENT_URL}`,
        line_items: [
          {
            price: STRIPE_PRICE_ID,
            quantity: quantity2,
          },
        ],
        mode: "subscription",
      });
      // console.log("session: ", session.id, session.url, session);

      // get id, save to user, return url
      const sessionId = session.id;
      console.log("sessionId: ", sessionId);

      // save session.id to the user in your database
      collection.updateOne(
        { email: email, pass: pass },
        { $set: { stripeSessionId: sessionId } }
      );

      res.json({ url: session.url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    res.send({ message: "already paid" });
  }
});

app.post("/initialLogin", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  try {
    const account = await collection.findOne({ email: email, pass: pass });

    if (!account) {
      res.send({ message: "no account" });
    } else {
      res.send({ message: "ok" });
    }
  } catch (e) {
    res.send({ message: "error" });
  }
});

app.post("/updateAccountInfo", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  console.log(requestData);
  const email = requestData.email;
  const pass = requestData.pass;
  const firstName = requestData.firstName;
  const lastName = requestData.lastName;
  const accountLocation = requestData.accountLocation;
  const company = requestData.company;
  const number = requestData.number;
  const newEmail = requestData.email;

  try {
    await collection.updateOne(
      { email: email, pass: pass },
      {
        $set: {
          firstName: firstName,
          lastName: lastName,
          accountLocation: accountLocation,
          company: company,
          number: number,
          email: newEmail,
        },
      }
    );
    res.send("ok");
  } catch (e) {
    console.log("failed to update info");
    res.send("error");
  }
});

app.post("/getAccountInfo", async (req, res) => {
  const database = (await clientPromise).db(dbName);
  const collection = database.collection(collectionName);

  const requestData = req.body;
  const email = requestData.email;
  const pass = requestData.pass;

  try {
    let account = await collection.findOne({ email: email, pass: pass });
    if (account && account !== null) {
      res.send({ message: "ok", account: account });
    }
  } catch (e) {
    console.log("failed to get info");
    res.send({ message: "error" });
  }
});

app.listen(APP_PORT, () => {
  console.log(`Server is listening at ` + url);
});
