const express = require("express");
const http = require("http");
const session = require("express-session");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const hbs = require("hbs");
const mongoose = require("mongoose");
const app = express();
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const jwtSecret = "yourSecretKey";
const moment = require("moment");

hbs.registerHelper("eq", function (a, b) {
  return a === b;
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "2014751020@uits.edu.bd",
    pass: "ehsejmpwnrmdktvd",
  },
});

const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
  console.log("port connected");
});

const socketIO = require("socket.io");
const io = socketIO(server);

app.use(express.static("public"));

app.use(
  session({
    secret: "123456",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const { connectToDatabase } = require("./mongo");
connectToDatabase();
const {
  Job,
  Engineer,
  Client,
  Bid,
  Work,
  Admin,
  Payment,
  FormData,
  Notification,
} = require("./mongo");

const tempelatePath = path.join(__dirname, "../tempelates");
const publicPath = path.join(__dirname, "../public");

console.log(publicPath);

hbs.registerHelper("generateStarRating", (rating) => {
  const roundedRating = Math.round(rating * 2) / 2;
  const fullStars = Math.floor(roundedRating);
  const hasHalfStar = roundedRating % 1 !== 0;
  const stars = Array(fullStars).fill("★").join("");
  return hasHalfStar ? `${stars}½` : stars;
});

app.set("view engine", "hbs");

app.set("views", tempelatePath);

app.use(express.static(publicPath));
app.use("/uploads", express.static("uploads"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    const user = req.session.user;

    if (user.sessionExpired) {
      req.session.destroy();
      return res.redirect(
        "/login?message=Session expired. Please log in again."
      );
    }

    if (user.role === "Client" && req.originalUrl.startsWith("/engineer")) {
      return res.status(403).send("Access Denied");
    } else if (
      user.role === "Engineer" &&
      req.originalUrl.startsWith("/client")
    ) {
      return res.status(403).send("Access Denied");
    } else if (
      (user.role === "Admin" && req.originalUrl.startsWith("/client")) ||
      req.originalUrl.startsWith("/engineer")
    ) {
      return res.status(403).send("Access Denied");
    }

    next();
  } else {
    res.redirect("/login");
  }
}

app.get("/about-us", async (req, res) => {
  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  res.render("about-us", {
    user: user,
    userId,
    isClient: req.session.user?.role === "Client",
    isEngineer: req.session.user?.role === "Engineer",
  });
});

app.get("/faq", async (req, res) => {
  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  res.render("faq", {
    user: user,
    userId,
    isClient: req.session.user?.role === "Client",
    isEngineer: req.session.user?.role === "Engineer",
  });
});

app.get("/work/:workId/chat", isAuthenticated, async (req, res) => {
  try {
    const workId = req.params.workId;

    const user = req.session.user;
    const role = req.session.user?.role;
    const userId = user?._id;

    let engineer = null;
    let client = null;

    if (role === "Engineer") {
      engineer = await Engineer.findById(userId);
    } else if (role === "Client") {
      client = await Client.findById(userId);
    }

    if (engineer && engineer.profilePicPath) {
      engineer.profilePicPath =
        "/" + engineer.profilePicPath.replace(/\\/g, "/");
    }

    if (client && client.profilePicPath) {
      client.profilePicPath = "/" + client.profilePicPath.replace(/\\/g, "/");
    }

    res.render("chat", {
      workId: workId,
      user: user,
      userId: userId,
      client: client,
      engineer: engineer,
      role: role,
      isClient: role === "Client",
      isEngineer: role === "Engineer",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching data");
  }
});

app.get("/api/work/:workId/chat-messages", async (req, res) => {
  try {
    const workId = req.params.workId;

    const work = await Work.findById(workId);

    if (!work) {
      console.error("Work not found for workId:", workId);
      return res.status(404).json({ error: "Work not found" });
    }

    const allChatMessages = [
      ...work.clientChatMessages.map((message) => ({
        senderRole: "Client",
        message: message.message,
        timestamp: message.timestamp,
      })),
      ...work.engineerChatMessages.map((message) => ({
        senderRole: "Engineer",
        message: message.message,
        timestamp: message.timestamp,
      })),
    ];

    allChatMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    res.json(allChatMessages);
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("chat message", async (data) => {
    const { senderRole, message, workId } = data;

    try {
      const work = await Work.findById(workId);

      if (!work) {
        console.error("Work not found for workId:", workId);
        return;
      }

      const senderObjectId = mongoose.Types.ObjectId.isValid(senderRole)
        ? mongoose.Types.ObjectId(senderRole)
        : null;

      let chatMessagesArray;
      if (senderRole.toLowerCase() === "client") {
        chatMessagesArray = "clientChatMessages";
      } else if (senderRole.toLowerCase() === "engineer") {
        chatMessagesArray = "engineerChatMessages";
      } else {
        console.error("Invalid sender role:", senderRole);
        return;
      }

      work[chatMessagesArray].push({
        sender: senderObjectId,
        message: message,
      });

      await work.save();

      io.emit("chat message", { senderRole, message, workId });
    } catch (error) {
      console.error("Error saving or broadcasting message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.get("/engineers", async (req, res) => {
  try {
    let userId = null;

    if (req.session.user) {
      userId = req.session.user._id;
    }

    let user = await Engineer.findById(userId);

    if (!user) {
      user = await Client.findById(userId);
    }

    
    const engineers = await Engineer.find();

  
    res.render("engineers", {
      engineers,
      user,
      userId,
      isClient: req.session.user?.role === "Client",
      isEngineer: req.session.user?.role === "Engineer",
    });
  } catch (error) {
    console.error("Error fetching engineers:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/signup2", (req, res) => {
  res.render("signup2");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/select", (req, res) => {
  res.render("select");
});

app.get("/rating", (req, res) => {
  res.render("rating");
});


app.get("/forgot-password", (req, res) => {
  res.render("forgot-password"); 
});

app.get("/", async (req, res) => {
  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user =
    (await Engineer.findById(userId)) ||
    (await Client.findById(userId)) ||
    (await Admin.findById(userId));

  const success = req.query.success === "true";

  res.render("home", {
    user,
    userId,
    isClient: req.session.user?.role === "Client",
    isEngineer: req.session.user?.role === "Engineer",
    isAdmin: req.session.user?.role === "Admin",
    success,
  });
});

app.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    const engineerData = {
      full_name: req.body.full_name,
      designation: req.body.designation,
      mobile: req.body.mobile,
      email: req.body.email,
      password: req.body.password,
      field_of_expertise: req.body.field_of_expertise,
      profilePicPath: req.file ? req.file.path : "",
    };

    const newEngineer = new Engineer(engineerData);
    await newEngineer.save();

    const verificationToken = jwt.sign({ id: newEngineer._id }, jwtSecret, {
      expiresIn: "1d",
    });
    newEngineer.verificationToken = verificationToken;
    await newEngineer.save();

    const verificationLink = `http://localhost:4000/verify-profile/${verificationToken}`;
    const verificationMailOptions = {
      from: "2014751020@uits.edu.bd",
      to: newEngineer.email,
      subject: "Profile Verification",
      text: `Click on the following link to verify your profile: ${verificationLink}`,
    };

    await transporter.sendMail(verificationMailOptions);

    res.render("login", {
      successMessage:
        "Sign up successful. Please check your email for profile verification.",
    });
  } catch (error) {
    console.error("Error saving to the database:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/signup2", upload.single("profilePic"), async (req, res) => {
  try {
    const clientData = {
      full_name: req.body.full_name,
      email: req.body.email,
      password: req.body.password,
      mobile: req.body.mobile,
      profilePicPath: req.file ? req.file.path : "",
    };

    const newClient = new Client(clientData);
    await newClient.save();

    const verificationToken = jwt.sign({ id: newClient._id }, jwtSecret, {
      expiresIn: "1d",
    });
    newClient.verificationToken = verificationToken;
    await newClient.save();

    const verificationLink = `http://localhost:4000/verify-client/${verificationToken}`;
    const verificationMailOptions = {
      from: "2014751020@uits.edu.bd",
      to: newClient.email,
      subject: "Profile Verification",
      text: `Click on the following link to verify your profile: ${verificationLink}`,
    };

    await transporter.sendMail(verificationMailOptions);

    res.render("login", {
      successMessage:
        "Sign up successful. Please check your email for profile verification.",
    });
  } catch (error) {
    console.error("Error saving to the database:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/verify-profile/:token", async (req, res) => {
  const token = req.params.token;

  try {
    const decoded = jwt.verify(token, jwtSecret);

    const user = await Engineer.findById(decoded.id);
    if (!user) {
      return res.status(404).send("User not found");
    }

    user.isVerified = true;
    await user.save();

    res.redirect("/login?verificationSuccess=true");
  } catch (error) {
    console.error("Token Verification Error:", error);
    res.status(400).send("Invalid or expired token");
  }
});

app.get("/verify-client/:token", async (req, res) => {
  const token = req.params.token;

  try {
    const decoded = jwt.verify(token, jwtSecret);

    const user = await Client.findById(decoded.id);
    if (!user) {
      return res.status(404).send("User not found");
    }

    user.isVerified = true;
    await user.save();

    res.redirect("/login?verificationSuccess=true");
  } catch (error) {
    console.error("Token Verification Error:", error);
    res.status(400).send("Invalid or expired token");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await Engineer.findOne({ email });
    let role = "Engineer";

    if (!user) {
      user = await Client.findOne({ email });
      role = "Client";
    }

    if (!user) {
      user = await Admin.findOne({ email });
      role = "Admin";
    }

    if (!user) {
      return res.render("login", {
        error: "Invalid email or password. User not found.",
      });
    }

    if (role !== "Admin" && !user.isVerified) {
      return res.render("login", {
        error:
          "Profile not verified. Please check your email for verification.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("login", { error: "Invalid email or password." });
    }

    req.session.user = {
      email: user.email,
      role: role,
      _id: user._id,
    };

    if (role === "Engineer" || role === "Client") {
      res.redirect(`/`);
    } else {
      res.redirect(`/admin-dashboard`);
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).render("login", { error: "Internal Server Error" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error while logging out:", err);
      res.status(500).send("Internal server error");
    } else {
      res.render("home");
    }
  });
});

const getStarRating = (rating) => {
  const roundedRating = Math.round(rating * 2) / 2;
  const fullStars = Math.floor(roundedRating);
  const hasHalfStar = roundedRating % 1 !== 0;

  const stars = Array(fullStars).fill("★").join("");

  return hasHalfStar ? `${stars}½` : stars;
};

app.get("/profile/:engineerId/:type", async (req, res) => {
  let engineerId = req.params.engineerId;
  let type = req.params.type;
  let engineer = null;
  let engineerProfile = false,
    cardInfo = false,
    rating = false,
    notification = false;
  if (type == 1) {
    engineerProfile = true;
  }
  if (type == 2) {
    cardInfo = true;
  }
  if (type == 3) {
    rating = true;
  }
  if (type == 4) {
    notification = true;
  }

  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  try {
    engineer = await Engineer.findById(engineerId);

    if (engineer) {
      const isClient = req.session.user && req.session.user.role === "Client";
      const isEngineer =
        req.session.user && req.session.user.role === "Engineer";

      const canEdit = isEngineer && engineerId === userId;

      if (user && user.profilePicPath) {
        user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
      }
      if (engineer && engineer.profilePicPath) {
        engineer.profilePicPath =
          "/" + engineer.profilePicPath.replace(/\\/g, "/");
      }

      const works = await Work.find({ engineer: engineerId }).populate({
        path: "client",
        select: "full_name email profilePicPath",
      });

      const engineerNotifications = await Notification.find({
        recipient: engineerId,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      const unreadNotificationCount = engineerNotifications.filter(
        (notification) => !notification.read
      ).length;

      res.render("profile", {
        userId,
        user: user,
        isClient: req.session.user?.role === "Client",
        isEngineer: req.session.user?.role === "Engineer",
        engineerId,
        engineer: engineer,
        canEdit: canEdit,
        engineerProfile,
        cardInfo,
        rating,
        works,
        engineerRating: getStarRating(engineer.rating),
        notification,
        engineerNotifications,
        unreadNotificationCount,
      });
    } else {
      res.status(404).send("Engineer not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/client-profile/:clientId/:type", async (req, res) => {
  try {
    let clientId = req.params.clientId;
    let type = req.params.type;
    let bids = null;
    let client = null;
    let clientJobs = null;
    let clientProfile = false,
      cardInfo = false,
      managePost = false,
      rating = false,
      payment = false,
      notification = false;

    if (type == 1) {
      clientProfile = true;
    }
    if (type == 2) {
      cardInfo = true;
    }
    if (type == 3) {
      managePost = true;
    }
    if (type == 4) {
      rating = true;
    }
    if (type == 5) {
      payment = true;
    }
    if (type == 6) {
      notification = true;
    }

    const clientPayments = await Payment.find({ client: clientId }).populate(
      "engineer"
    );

    let userId = null;

    if (req.session.user) {
      userId = req.session.user._id;
    }

    let user = await Engineer.findById(userId);

    if (!user) {
      user = await Client.findById(userId);
    }

    client = await Client.findById(clientId);

    if (client) {
      const isClient = req.session.user && req.session.user.role === "Client";
      const isEngineer =
        req.session.user && req.session.user.role === "Engineer";

      const canEdit = isClient && clientId === userId;

      if (user && user.profilePicPath) {
        user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
      }
      if (client && client.profilePicPath) {
        client.profilePicPath = "/" + client.profilePicPath.replace(/\\/g, "/");
      }

      // Fetching client jobs
      clientJobs = await Job.find({ client: client._id });

      // Extracting jobIds from clientJobs
      const jobIds = clientJobs.map((job) => job._id);

      const works = await Work.find({ client: clientId })
        .populate({
          path: "engineer",
          select: "full_name email profilePicPath",
        })
        .populate({
          path: "job",
          select: "jobTitle category specifiedCategory",
        });

      const clientNotifications = await Notification.find({
        recipient: clientId,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      const unreadNotificationCount = clientNotifications.filter(
        (notification) => !notification.read
      ).length;

      res.render("client-profile", {
        userId,
        user,
        isClient: req.session.user?.role === "Client",
        isEngineer: req.session.user?.role === "Engineer",
        clientId,
        client,
        canEdit,
        clientJobs,
        clientProfile,
        cardInfo,
        managePost,
        bids,
        payment,
        rating,
        works,
        clientPayments,
        clientRating: getStarRating(client.rating),
        jobIds,
        notification,
        clientNotifications,
        unreadNotificationCount,
      });
    } else {
      res.status(404).send("Client not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.post("/mark-notifications-as-read", async (req, res) => {
  try {
    const clientId = req.session.user._id;

    // Mark all unread notifications as read for the client
    await Notification.updateMany(
      { recipient: clientId, read: false },
      { read: true }
    );

    res.send("Notifications marked as read");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error marking notifications as read");
  }
});

app.get("/edit-client-profile/:clientId", isAuthenticated, async (req, res) => {
  let clientId = req.params.clientId;

  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  const clientData = await Client.findById(clientId);

  if (clientData) {
    res.render("edit-client-profile", {
      userId,
      user: user,
      isClient: req.session.user?.role === "Client",
      isEngineer: req.session.user?.role === "Engineer",
      clientId,
      client: clientData,
    });
  } else {
    res.status(404).send("Client data not found");
  }
});

app.post(
  "/edit-client-profile/:clientId",
  isAuthenticated,
  async (req, res) => {
    upload.single("profilePic")(req, res, async (err) => {
      if (err) {
        console.error("File Upload Error:", err);
        return res.status(500).send("File upload failed.");
      }
      try {
        const {
          full_name,
          mobile,
          address,
          location,
          website,
          twitter,
          instagram,
          facebook,
          cardHolderName,
          cardNumber,
          cardExpMonth,
          cardExpYear,
          cardCVV,
          balance,
        } = req.body;

        const clientEmail = req.session.user.email;

        const currentClient = await Client.findOne({ email: clientEmail });
        const currentProfilePicPath = currentClient.profilePicPath;

        let profilePicPath = currentProfilePicPath;

        if (req.file) {
          profilePicPath = req.file.path.replace(/\\/g, "/");
        }

        const updateData = {
          mobile,
          address,
          location,
          website,
          twitter,
          instagram,
          facebook,
          cardHolderName,
          cardNumber,
          cardExpMonth,
          cardExpYear,
          cardCVV,
          balance,
          profilePicPath,
        };

        if (full_name) {
          updateData.full_name = full_name;
        }

        const updatedClient = await Client.findOneAndUpdate(
          { email: clientEmail },
          updateData,
          { new: true }
        );

        res.redirect(`/client-profile/${req.session.user._id}/1`);
      } catch (error) {
        console.error("Error updating client profile:", error);
        res.status(500).send("Internal Server Error");
      }
    });
  }
);

app.get(
  "/edit-engineer-profile/:engineerId",
  isAuthenticated,
  async (req, res) => {
    let engineerId = req.params.engineerId;

    let userId = null;

    if (req.session.user) {
      userId = req.session.user._id;
    }

    let user = await Engineer.findById(userId);

    if (!user) {
      user = await Client.findById(userId);
    }

    const engineerData = await Engineer.findById(engineerId);

    if (engineerData) {
      res.render("edit-engineer-profile", {
        userId,
        user: user,
        isClient: req.session.user?.role === "Client",
        isEngineer: req.session.user?.role === "Engineer",
        engineerId,
        engineer: engineerData,
      });
    } else {
      res.status(404).send("Engineer data not found");
    }
  }
);

app.post(
  "/edit-engineer-profile/:engineerId",
  isAuthenticated,
  async (req, res) => {
    upload.single("profilePic")(req, res, async (err) => {
      if (err) {
        console.error("File Upload Error:", err);
        return res.status(500).send("File upload failed.");
      }

      try {
        const {
          full_name,
          designation,
          mobile,
          field_of_expertise,
          location,
          website,
          github,
          twitter,
          instagram,
          facebook,
          skill,
          experience,
          education,
          address,
          rating,
          cardHolderName,
          cardNumber,
          cardExpMonth,
          cardExpYear,
          cardCVV,
          balance,
        } = req.body;

        const engineerEmail = req.session.user.email;

        const currentEngineer = await Engineer.findOne({
          email: engineerEmail,
        });
        const currentProfilePicPath = currentEngineer.profilePicPath;

        let profilePicPath = currentProfilePicPath;

        if (req.file) {
          profilePicPath = req.file.path.replace(/\\/g, "/");
        }

        const updateData = {
          designation,
          mobile,
          field_of_expertise,
          location,
          website,
          github,
          twitter,
          instagram,
          facebook,
          skill,
          experience,
          education,
          address,
          rating,
          cardHolderName,
          cardNumber,
          cardExpMonth,
          cardExpYear,
          cardCVV,
          balance,
          profilePicPath,
        };

        if (full_name) {
          updateData.full_name = full_name;
        }

        const updatedEngineer = await Engineer.findOneAndUpdate(
          { email: engineerEmail },
          updateData,
          { new: true }
        );

        res.redirect(`/profile/${req.session.user._id}/1`);
      } catch (error) {
        console.error("Error updating client profile:", error);
        res.status(500).send("Internal Server Error");
      }
    });
  }
);

app.get("/post-job", isAuthenticated, async (req, res) => {
  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  if (req.session.user.role === "Client") {
    try {
      const clientId = req.session.user._id;
      const client = await Client.findById(clientId);

      if (user && user.profilePicPath) {
        user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
      }
      if (client && client.profilePicPath) {
        client.profilePicPath = "/" + client.profilePicPath.replace(/\\/g, "/");
      }

      res.render("post-job", {
        userId,
        user: user,
        isClient: req.session.user?.role === "Client",
        isEngineer: req.session.user?.role === "Engineer",
        client: client,
        clientId,
      });
    } catch (error) {
      console.error("Error fetching client data:", error);
      res.status(500).send("Internal server error");
    }
  } else {
    res.status(403).send("Access Denied");
  }
});

app.post("/post-job", isAuthenticated, async (req, res) => {
  const {
    job_title,
    category,
    specified_category,
    job_details,
    job_requirements,
    job_location,
    job_deadline,
    job_price_range,
    clientEmail = req.session.user.email,
  } = req.body;

  try {
    const client = await Client.findOne({ email: clientEmail });

    if (!client) {
      return res.status(404).send("Client data not found");
    }

    const jobData = {
      jobTitle: job_title,
      client: client._id,
      category: category,
      specifiedCategory: specified_category,
      jobDetails: job_details,
      jobRequirements: job_requirements,
      jobLocation: job_location,
      jobDeadline: new Date(job_deadline),
      jobPriceRange: job_price_range,
      clientName: client.full_name,
    };

    const job = new Job(jobData);
    await job.save();

    res.redirect(`/client-profile/${client._id}/3`);
  } catch (error) {
    console.error("Error saving job:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/edit-job/:jobId", isAuthenticated, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const job = await Job.findById(jobId);

    // Ensure the job exists and the current user is the owner
    if (!job || job.client.toString() !== req.session.user._id) {
      return res.status(404).send("Job not found or unauthorized access");
    }

    // Fetch user details
    let userId = null;
    if (req.session.user) {
      userId = req.session.user._id;
    }

    let user = await Engineer.findById(userId);
    if (!user) {
      user = await Client.findById(userId);
    }
    if (user && user.profilePicPath) {
      user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
    }

    const categories = [
      "Architect",
      "Construction",
      "Interior_Design",
      "Floor_Plan",
      "Architectural_Design_And_Drafting",
      "Structural_Engineering",
      "Electrical_Installation",
      "Plumbing_and_Sanitary Works",
      "Design_and_Decoration",
      "Construction_Project_Management",
      "Structural_Renovation_and_Retrofitting",
      "Building_Inspection_and_Code_Compliance",
    ];

    const formattedDate = job.jobDeadline
      ? job.jobDeadline.toISOString().split("T")[0]
      : "";

    res.render("edit-job", {
      job,
      formattedDate,
      categories,
      user,
      isClient: req.session.user?.role === "Client",
      isEngineer: req.session.user?.role === "Engineer",
    });
  } catch (error) {
    console.error("Error fetching job data:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/edit-job/:jobId", isAuthenticated, async (req, res) => {
  const jobId = req.params.jobId;
  const {
    job_title,
    category,
    specified_category,
    job_details,
    job_requirements,
    job_location,
    job_deadline,
    job_price_range,
  } = req.body;

  try {
    const job = await Job.findById(jobId);

    // Ensure the job exists and the current user is the owner (you may need to modify this check)
    if (!job || job.client.toString() !== req.session.user._id) {
      return res.status(404).send("Job not found or unauthorized access");
    }

    // Update job details
    job.jobTitle = job_title;
    job.category = category;
    job.specifiedCategory = specified_category;
    job.jobDetails = job_details;
    job.jobRequirements = job_requirements;
    job.jobLocation = job_location;
    job.jobDeadline = new Date(job_deadline);
    job.jobPriceRange = job_price_range;

    // Save the updated job to the database
    await job.save();

    res.redirect(`/client-profile/${req.session.user._id}/3`);
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/delete-job/:jobId", isAuthenticated, async (req, res) => {
  const jobId = req.params.jobId;

  try {
    const job = await Job.findById(jobId);

    // Ensure the job exists and the current user is the owner
    if (!job || job.client.toString() !== req.session.user._id) {
      return res.status(404).send("Job not found or unauthorized access");
    }

    // Delete the job
    await Job.findByIdAndDelete(jobId);

    // Redirect to a page or send a response indicating success
    res.redirect(`/client-profile/${req.session.user._id}/3`);
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).send("Internal server error");
  }
});

function sortJobsByDate(jobs, sortBy) {
  if (sortBy === "asc") {
    return jobs.sort(
      (a, b) => new Date(a.jobDeadline) - new Date(b.jobDeadline)
    );
  } else if (sortBy === "desc") {
    return jobs.sort(
      (a, b) => new Date(b.jobDeadline) - new Date(a.jobDeadline)
    );
  } else {
    return jobs;
  }
}

// Helper function to filter jobs by price range
function filterJobsByPrice(jobs, minPrice, maxPrice) {
  const min = parseFloat(minPrice);
  const max = parseFloat(maxPrice);

  return jobs.filter((job) => {
    const jobPrice = parseFloat(job.jobPriceRange);
    return jobPrice >= min && jobPrice <= max;
  });
}

app.get("/job-list/:categoryName", isAuthenticated, async (req, res) => {
  try {
    let clientId = null;
    let engineerId = null;
    let user = null;

    if (req.session.user) {
      const userId = req.session.user._id;
      user =
        (await Engineer.findById(userId)) || (await Client.findById(userId));
    }

    if (req.session.user.role === "Client") {
      clientId = req.session.user._id;
    } else if (req.session.user.role === "Engineer") {
      engineerId = req.session.user._id;
    }

    const sortBy = req.query.sort || "asc";
    const minPrice = req.query.minPrice || 0;
    const maxPrice = req.query.maxPrice || Infinity;
    const page = parseInt(req.query.page) || 1;
    const pageSize = 5; // Number of jobs per page

    let jobs;
    let totalJobs;

    if (req.params.categoryName === "all") {
      // Fetch all jobs that match the price range
      jobs = await Job.find({
        price: { $gte: minPrice, $lte: maxPrice },
      }).sort({ jobDeadline: sortBy });

      // Count all jobs that match the price range
      totalJobs = await Job.countDocuments({
        price: { $gte: minPrice, $lte: maxPrice },
      });
    } else {
      // Fetch jobs based on category and price range
      jobs = await Job.find({
        category: req.params.categoryName,
        price: { $gte: minPrice, $lte: maxPrice },
      }).sort({ jobDeadline: sortBy });

      // Count jobs based on category and price range
      totalJobs = await Job.countDocuments({
        category: req.params.categoryName,
        price: { $gte: minPrice, $lte: maxPrice },
      });
    }

    if (user && user.profilePicPath) {
      user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
    }

    const sortedAndFilteredJobs = sortJobsByDate(jobs, sortBy);
    const filteredJobs = filterJobsByPrice(
      sortedAndFilteredJobs,
      minPrice,
      maxPrice
    );

    // Pagination logic
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const visibleJobs = filteredJobs.slice(startIndex, endIndex);

    const currentPage = page;
    const totalPages = Math.ceil(filteredJobs.length / pageSize);
    const morePages = page < totalPages;
    const currentPageGreaterThanOne = currentPage > 1;
    const currentPageMinusOne = currentPage - 1;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const showPageNumbers = totalPages > 1;
    res.render("job-list", {
      jobs: visibleJobs,
      userId: user?._id,
      user,
      isClient: req.session.user?.role === "Client",
      isEngineer: req.session.user?.role === "Engineer",
      clientId,
      engineerId,
      sortBy,
      category: req.params.categoryName || "all",
      minPrice,
      maxPrice,
      currentPage: page,
      morePages,
      currentPagePlusOne: page + 1,
      currentPageGreaterThanOne,
      currentPageMinusOne,
      pages: showPageNumbers ? pages : [],
      totalPages,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/job-details/:jobId", isAuthenticated, async (req, res) => {
  const jobId = req.params.jobId;
  let clientId = null;
  let engineerId = null;
  let client = null;
  let engineer = null;
  let job = null;
  let hasSubmittedBid = false;

  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  if (req.session.user.role === "Client") {
    clientId = req.session.user._id;
  } else if (req.session.user.role === "Engineer") {
    engineerId = req.session.user._id;

    const existingBid = await Bid.findOne({ job: jobId, engineer: engineerId });
    hasSubmittedBid = !!existingBid;
  }

  try {
    job = await Job.findById(jobId);

    if (job) {
      if (req.session.user.role === "Client") {
        client = await Client.findById(clientId);
      } else if (req.session.user.role === "Engineer") {
        engineer = await Engineer.findById(engineerId);
      }
      if (user && user.profilePicPath) {
        user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
      }
      if (client && client.profilePicPath) {
        client.profilePicPath = "/" + client.profilePicPath.replace(/\\/g, "/");
      }
      if (engineer && engineer.profilePicPath) {
        engineer.profilePicPath =
          "/" + engineer.profilePicPath.replace(/\\/g, "/");
      }

      res.render("job-details", {
        userId,
        user: user,
        isClient: req.session.user?.role === "Client",
        isEngineer: req.session.user?.role === "Engineer",
        clientId: clientId,
        engineerId: engineerId,
        client,
        engineer,
        job,
        hasSubmittedBid,
      });
    } else {
      res.status(404).send("Job not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.post("/submit-bid/:jobId", isAuthenticated, async (req, res) => {
  const jobId = req.params.jobId;
  const engineerId = req.body.engineerId;

  if (!engineerId) {
    return res.status(400).send("Engineer ID not found");
  }

  try {
    const existingBid = await Bid.findOne({ job: jobId, engineer: engineerId });

    if (existingBid) {
      return res
        .status(400)
        .send("Engineer has already submitted a bid for this job");
    }

    const engineer = await Engineer.findById(engineerId);
    const job = await Job.findById(jobId);

    const { bidAmount, bidDetails } = req.body;

    const newBid = new Bid({
      job: jobId,
      engineer: engineerId,
      bidAmount,
      bidDetails,
      engineerFullName: engineer.full_name,
      jobTitle: job.jobTitle,
      jobDeadline: job.jobDeadline,
      client: job.client._id,
    });

    await newBid.save();

    // Create a new notification for the client
    const newNotification = new Notification({
      recipient: job.client._id,
      content: `Engineer ${engineer.full_name} has submitted a bid for your job "${job.jobTitle}".`,
      type: "bidSubmitted",
      job: jobId,
    });

    await newNotification.save();

    res.redirect(`/job-details/${jobId}`);
  } catch (error) {
    console.error("Error submitting bid:", error);
    res.status(500).send("Error submitting bid");
  }
});

app.get("/my-bids/:engineerId", isAuthenticated, async (req, res) => {
  let engineerId = req.params.engineerId;
  let engineer = null;

  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  try {
    if (req.session.user.role === "Engineer") {
      engineer = await Engineer.findById(engineerId);
    }

    if (user && user.profilePicPath) {
      user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
    }
    if (engineer && engineer.profilePicPath) {
      engineer.profilePicPath =
        "/" + engineer.profilePicPath.replace(/\\/g, "/");
    }

    const userBids = await Bid.find({ engineer: req.session.user._id });

    res.render("my-bids", {
      userId,
      user: user,
      isClient: req.session.user?.role === "Client",
      isEngineer: req.session.user?.role === "Engineer",
      engineerId: engineerId,
      bids: userBids,
      engineer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/bids/:clientId", isAuthenticated, async (req, res) => {
  let clientId = req.params.clientId;
  let client = null;

  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  try {
    if (req.session.user.role === "Client") {
      client = await Client.findById(clientId);
    }

    if (user && user.profilePicPath) {
      user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
    }
    if (client && client.profilePicPath) {
      client.profilePicPath = "/" + client.profilePicPath.replace(/\\/g, "/");
    }

    const bids = await Bid.find({ client: clientId });

    if (bids) {
      res.render("bids", {
        userId,
        user: user,
        isClient: req.session.user?.role === "Client",
        isEngineer: req.session.user?.role === "Engineer",
        clientId: clientId,
        client,
        bids,
      });
    } else {
      res.status(404).send("Bids not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

const createNotification = async (recipient, content, type, job, bid) => {
  const newNotification = new Notification({
    recipient,
    content,
    type,
    job,
    bid,
  });

  await newNotification.save();
};

app.post("/accept-bid", async (req, res) => {
  try {
    const { bidId } = req.body;

    if (!bidId) {
      return res.status(400).json({ error: "Bid ID is required" });
    }

    const updatedBid = await Bid.findByIdAndUpdate(bidId, {
      status: "accepted",
    });

    if (!updatedBid) {
      return res.status(404).json({ error: "Bid not found or not updated" });
    }

    const acceptedBid = await Bid.findById(bidId);

    if (!acceptedBid) {
      return res.status(404).json({ error: "Accepted bid not found" });
    }

    const clientId = acceptedBid.client;
    const engineerId = acceptedBid.engineer;
    const jobId = acceptedBid.job;

    const [client, engineer, job] = await Promise.all([
      Client.findById(clientId),
      Engineer.findById(engineerId),
      Job.findById(jobId),
    ]);

    if (!client || !engineer || !job) {
      return res.status(404).json({ error: "Related data not found" });
    }

    const newWork = new Work({
      client: client,
      engineer: engineer,
      job: job,
      bid: acceptedBid,
    });

    const savedWork = await newWork.save();

    // Create a notification for the engineer
    await createNotification(
      engineerId,
      `Your bid for the job "${acceptedBid.jobTitle}" has been accepted.`,
      "bidAccepted",
      jobId,
      bidId
    );

    res.json({
      jobTitle: acceptedBid.jobTitle,
      jobDeadline: acceptedBid.jobDeadline,
      engineerFullName: acceptedBid.engineerFullName,
      bidAmount: acceptedBid.bidAmount,
      bidDetails: acceptedBid.bidDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to accept bid" });
  }
});

app.post("/reject-bid", async (req, res) => {
  try {
    const { bidId } = req.body;

    if (!bidId) {
      return res.status(400).json({ error: "Bid ID is required" });
    }

    const updatedBid = await Bid.findByIdAndUpdate(bidId, {
      status: "rejected",
    });

    if (!updatedBid) {
      return res.status(404).json({ error: "Bid not found or not updated" });
    }

    const rejectedBid = await Bid.findById(bidId);

    if (!rejectedBid) {
      return res.status(404).json({ error: "Bid not found" });
    }

    const clientId = rejectedBid.client;
    const engineerId = rejectedBid.engineer;
    const jobId = rejectedBid.job;

    const [client, engineer, job] = await Promise.all([
      Client.findById(clientId),
      Engineer.findById(engineerId),
      Job.findById(jobId),
    ]);

    if (!client || !engineer || !job) {
      return res.status(404).json({ error: "Related data not found" });
    }

    // Create a notification for the engineer
    await createNotification(
      engineerId,
      `Your bid for the job "${rejectedBid.jobTitle}" has been rejected.`,
      "bidRejected",
      jobId,
      bidId
    );

    res.json({
      jobTitle: rejectedBid.jobTitle,
      jobDeadline: rejectedBid.jobDeadline,
      engineerFullName: rejectedBid.engineerFullName,
      bidAmount: rejectedBid.bidAmount,
      bidDetails: rejectedBid.bidDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reject bid" });
  }
});

app.get("/api/accepted-bids", isAuthenticated, async (req, res) => {
  try {
    const userRole = req.session.user.role;
    const userId = req.session.user._id;

    const acceptedBids = await Bid.find({
      status: "accepted",
      [userRole === "Client" ? "client" : "engineer"]: userId,
    }).exec();

    const bidsWithWorkIds = await Promise.all(
      acceptedBids.map(async (bid) => {
        const work = await Work.findOne({ bid: bid._id });

        if (!work) {
          return null;
        }

        return {
          workId: work._id,
          jobTitle: bid.jobTitle,
          jobDeadline: bid.jobDeadline,
          engineerFullName: bid.engineerFullName,
          bidAmount: bid.bidAmount,
          bidDetails: bid.bidDetails,
        };
      })
    );

    res.json(bidsWithWorkIds.filter((bid) => bid !== null));
  } catch (err) {
    res.status(500).json({ error: "Error fetching accepted bids" });
  }
});

app.get("/api/rejected-bids", isAuthenticated, async (req, res) => {
  try {
    const userRole = req.session.user.role;
    const userId = req.session.user._id;

    const rejectedBids = await Bid.find({
      status: "rejected",
      [userRole === "Client" ? "client" : "engineer"]: userId,
    }).exec();

    const bidsWithWorkIds = await Promise.all(
      rejectedBids.map(async (bid) => {
        const work = await Work.findOne({ bid: bid._id });

        if (!work) {
          return null;
        }

        return {
          workId: work._id,
          jobTitle: bid.jobTitle,
          jobDeadline: bid.jobDeadline,
          engineerFullName: bid.engineerFullName,
          bidAmount: bid.bidAmount,
          bidDetails: bid.bidDetails,
        };
      })
    );

    res.json(bidsWithWorkIds.filter((bid) => bid !== null));
  } catch (err) {
    res.status(500).json({ error: "Error fetching rejected bids" });
  }
});

app.get("/api/pending-bids", async (req, res) => {
  try {
    if (req.session.user.role == "Client") {
      const pendingBids = await Bid.find({
        status: "pending",
        client: req.session.user._id,
      }).exec();

      res.json(pendingBids);
    } else {
      const pendingBids = await Bid.find({
        status: "pending",
      }).exec();

      res.json(pendingBids);
    }
  } catch (err) {
    res.status(500).json({ error: "Error fetching pending bids" });
  }
});

app.get("/work/:workId", isAuthenticated, async (req, res) => {
  let clientId = null;
  let engineerId = null;
  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  if (req.session.user.role === "Client") {
    clientId = req.session.user._id;
  } else if (req.session.user.role === "Engineer") {
    engineerId = req.session.user._id;
  }

  try {
    if (user && user.profilePicPath) {
      user.profilePicPath = "/" + user.profilePicPath.replace(/\\/g, "/");
    }

    const workId = req.params.workId;

    if (!mongoose.Types.ObjectId.isValid(workId)) {
      return res.status(400).send("Invalid workId");
    }

    const validWorkId = mongoose.Types.ObjectId(workId);

    const work = await Work.findById(validWorkId);

    if (!work) {
      return res.status(404).send("Work not found");
    }

    const client = await Client.findById(work.client);
    const engineer = await Engineer.findById(work.engineer);
    const job = await Job.findById(work.job);

    if (!client || !engineer || !job) {
      return res.status(404).send("Related data not found");
    }

    const bid = await Bid.findById(work.bid);

    if (!bid) {
      return res.status(404).send("Bid not found");
    }

    const chatMessages = work.chatMessages;

    const isPaymentComplete = work.paymentComplete;
    const isratedByClient = work.ratedByClient;
    const isratedByEngineer = work.ratedByEngineer;

    res.render("work", {
      work,
      client,
      engineer,
      job,
      bid,
      userId,
      user: user,
      isClient: req.session.user?.role === "Client",
      isEngineer: req.session.user?.role === "Engineer",
      clientId,
      engineerId,
      workId,
      isPaymentComplete,
      isratedByClient,
      isratedByEngineer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching data");
  }
});

// Import the required modules and set up your transporter



app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    let user = await Engineer.findOne({ email });
    if (!user) {
      user = await Client.findOne({ email });
    }

    if (!user) {
      return res.status(404).send("User not found");
    }

    const resetToken = jwt.sign({ id: user._id }, "yourSecretKey", {
      expiresIn: "1h",
    });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;

    await user.save();

    const resetLink = `http://localhost:4000/reset-password/${resetToken}`;
    const mailOptions = {
      from: "2014751020@uits.edu.bd",
      to: user.email,
      subject: "Password Reset",
      text: `Click on the following link to reset your password: ${resetLink}`,
    };

    await transporter.sendMail(mailOptions);

    // Instead of redirecting directly, render the template with a success message
    res.render("forgot-password", { resetEmailSent: true });
  } catch (error) {
    console.error("Error during forgot password:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/reset-password/:token", async (req, res) => {
  const token = req.params.token;

  try {
    const decoded = jwt.verify(token, jwtSecret);

    res.render("reset-password", { token });
  } catch (error) {
    console.error("Token Verification Error:", error);
    res.status(400).send("Invalid or expired token");
  }
});

app.post("/reset-password/:token", async (req, res) => {
  const token = req.params.token;
  const newPassword = req.body.password;

  try {
    const decoded = jwt.verify(token, jwtSecret);

    let user = await Engineer.findById(decoded.id);

    if (!user) {
      user = await Client.findById(decoded.id);
    }

    if (!user) {
      return res.status(404).send("User not found");
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Instead of redirecting directly, render the template with a success message
    res.render("reset-password", { token, resetSuccess: true });
  } catch (error) {
    console.error("Error during password reset:", error);
    res.status(400).send("Invalid or expired token");
  }
});

app.get("/admin-dashboard", isAuthenticated, async (req, res) => {
  if (req.session.user.role === "Admin") {
    try {
      const userId = req.session.user._id;
      const user = await Admin.findById(userId);
      const [
        engineers,
        clients,
        jobs,
        bids,
        works,
        contactMessages,
        payments,
        admin,
      ] = await Promise.all([
        Engineer.find(),
        Client.find(),
        Job.find(),
        Bid.find(),
        Work.find(),
        FormData.find(),
        Payment.find()
          .populate({
            path: "work",
            populate: {
              path: "job",
              select: "jobTitle",
            },
          })
          .populate("engineer", "full_name email")
          .populate("client", "full_name email"),
        Admin.findOne({ _id: req.session.user._id }),
      ]);

      const canEdit = userId === req.session.user._id;

      res.render("admin-dashboard", {
        user,
        userId: req.session.user._id,
        engineers,
        clients,
        jobs,
        bids,
        works,
        contactMessages,
        payments,
        admin,
        canEdit,
        isAdmin: req.session.user?.role === "Admin",
      });
    } catch (error) {
      console.error("Error fetching data for admin dashboard:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.status(403).send("Access Denied");
  }
});

app.post("/admin/delete-job/:id", isAuthenticated, async (req, res) => {
  const jobId = req.params.id;

  try {
    await Job.findByIdAndDelete(jobId);
    res.redirect("/admin-dashboard");
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/delete-client/:id", isAuthenticated, async (req, res) => {
  const clientId = req.params.id;

  try {
    await Client.findByIdAndDelete(clientId);
    res.redirect("/admin-dashboard");
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/delete-engineer/:id", isAuthenticated, async (req, res) => {
  const engineerId = req.params.id;
  console.log("Deleting engineer with ID:", engineerId);
  try {
    await Engineer.findByIdAndDelete(engineerId);
    res.redirect("/admin-dashboard");
  } catch (error) {
    console.error("Error deleting engineer:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/delete-bid/:id", isAuthenticated, async (req, res) => {
  const bidId = req.params.id;

  try {
    await Bid.findByIdAndDelete(bidId);
    res.redirect("/admin-dashboard");
  } catch (error) {
    console.error("Error deleting bid:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/delete-work/:id", isAuthenticated, async (req, res) => {
  const workId = req.params.id;

  try {
    await Work.findByIdAndDelete(workId);
    res.redirect("/admin-dashboard");
  } catch (error) {
    console.error("Error deleting work:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/process-payment", async (req, res) => {
  try {
    const { clientId, engineerId, workId, paymentAmount } = req.body;

    const payment = new Payment({
      engineer: engineerId,
      client: clientId,
      work: workId,
      amount: parseFloat(paymentAmount),
    });

    await payment.save();

    const engineer = await Engineer.findById(engineerId);
    if (!engineer) {
      return res.status(404).send("Engineer not found");
    }

    engineer.balance += parseFloat(paymentAmount);
    await engineer.save();

    const work = await Work.findById(workId);
    if (!work) {
      return res.status(404).send("Work not found");
    }

    const client = await Client.findById(work.client);
    if (!client) {
      return res.status(404).send("Client not found");
    }

    client.balance -= parseFloat(paymentAmount);
    await client.save();

    const isPaymentSuccessful = true;

    if (isPaymentSuccessful) {
      engineer.balance += parseFloat(paymentAmount);
      await engineer.save();

      const work = await Work.findById(workId);
      if (work) {
        work.paymentComplete = true;
        await work.save();
      }

      return res.redirect(`/work/${workId}?success=true`);
    } else {
      return res.status(400).send("Payment failed");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing payment");
  }
});

app.post("/submit-client-rating", isAuthenticated, async (req, res) => {
  try {
    const { workId, engineerId, clientRating, clientFeedback, userId } =
      req.body;

    const work = await Work.findById(workId);
    if (!work) {
      return res.status(404).send("Work not found");
    }

    if (userId !== engineerId) {
      return res.status(403).send("Permission denied");
    }

    if (work.ratedByEngineer) {
      return res
        .status(400)
        .send("Work has already been rated by the engineer");
    }

    work.clientRating = parseFloat(clientRating);
    work.clientFeedback = clientFeedback;
    work.ratedByEngineer = true;

    await work.save();

    res.redirect(`/work/${workId}?engineerRatingSuccess=true`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error submitting client rating");
  }
});

app.post("/submit-engineer-rating", isAuthenticated, async (req, res) => {
  try {
    const { workId, clientId, engineerRating, engineerFeedback, userId } =
      req.body;

    const work = await Work.findById(workId);
    if (!work) {
      return res.status(404).send("Work not found");
    }

    if (userId !== clientId) {
      return res.status(403).send("Permission denied");
    }

    if (work.ratedByClient) {
      return res.status(400).send("Work has already been rated by the client");
    }

    work.engineerRating = parseFloat(engineerRating);
    work.engineerFeedback = engineerFeedback;
    work.ratedByClient = true;

    await work.save();

    res.redirect(`/work/${workId}?clientRatingSuccess=true`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error submitting engineer rating");
  }
});

// ... (previous server-side code)

// Define the route for the form submission
app.post("/submit-form", async (req, res) => {
  try {
    // Destructure form data from req.body
    const { name, email, subject, message } = req.body;

    // Create a new FormData document based on the submitted form data
    const formData = new FormData({
      name,
      email,
      subject,
      message,
    });

    // Save the form data to the database
    await formData.save();

    // Redirect to the home page with a success parameter
    res.redirect("/?success=true");
  } catch (error) {
    console.error(error);
    // Respond with an error message
    res.status(500).send("Internal server error");
  }
});

// Add a route for displaying the edit form
// GET route for rendering the edit admin profile page
app.get("/edit-admin-profile/:adminId", isAuthenticated, async (req, res) => {
  let adminId = req.params.adminId;

  let userId = null;

  if (req.session.user) {
    userId = req.session.user._id;
  }

  let user = await Engineer.findById(userId);

  if (!user) {
    user = await Client.findById(userId);
  }

  const adminData = await Admin.findById(adminId);

  if (adminData) {
    res.render("edit-admin-profile", {
      userId,
      user: user,
      isAdmin: req.session.user?.role === "Admin",
      adminId,
      admin: adminData,
    });
  } else {
    res.status(404).send("Admin data not found");
  }
});

// POST route for handling the form submission
app.post("/edit-admin-profile/:adminId", isAuthenticated, async (req, res) => {
  upload.single("profilePic")(req, res, async (err) => {
    if (err) {
      console.error("File Upload Error:", err);
      return res.status(500).send("File upload failed.");
    }
    try {
      const {
        full_name,
        email,
        password,
        mobile,
        address,
        // Add other fields from adminSchema as needed
      } = req.body;

      const adminId = req.params.adminId;
      const currentAdmin = await Admin.findById(adminId);
      const currentProfilePicPath = currentAdmin.profilePicPath;

      let profilePicPath = currentProfilePicPath;

      if (req.file) {
        profilePicPath = req.file.path.replace(/\\/g, "/");
      }

      const updateData = {
        email,
        password, // You may want to handle password updates securely
        mobile,
        address,
        // Add other fields from adminSchema as needed
        profilePicPath,
      };

      if (full_name) {
        updateData.full_name = full_name;
      }

      const updatedAdmin = await Admin.findByIdAndUpdate(adminId, updateData, {
        new: true,
      });

      res.redirect(`/admin-dashboard`);
    } catch (error) {
      console.error("Error updating admin profile:", error);
      res.status(500).send("Internal Server Error");
    }
  });
});

app.get("/search", async (req, res) => {
  try {


    let userId = null;

    if (req.session.user) {
      userId = req.session.user._id;
    }

    let user =
      (await Engineer.findById(userId)) ||
      (await Client.findById(userId)) ||
      (await Admin.findById(userId));


    const { query: keyword } = req.query;

   
    if (!keyword || typeof keyword !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or missing search keyword" });
    }

   

    const engineerfullNameResults = await Engineer.find({
      full_name: { $regex: new RegExp(keyword, "i") },
    });
    const designationResults = await Engineer.find({
      designation: { $regex: new RegExp(keyword, "i") },
    });
    const locationResultsEngineer = await Engineer.find({
      location: { $regex: new RegExp(keyword, "i") },
    });
    const expertiseResults = await Engineer.find({
      field_of_expertise: { $regex: new RegExp(keyword, "i") },
    });

    const engineerResults = [
      ...engineerfullNameResults,
      ...designationResults,
      ...locationResultsEngineer,
      ...expertiseResults,
    ];

    const jobTitleResults = await Job.find({
      jobTitle: { $regex: new RegExp(keyword, "i") },
    });
    const categoryResults = await Job.find({
      category: { $regex: new RegExp(keyword, "i") },
    });
    const locationResultsJob = await Job.find({
      jobLocation: { $regex: new RegExp(keyword, "i") },
    });
    const detailsResults = await Job.find({
      jobDetails: { $regex: new RegExp(keyword, "i") },
    });
    const requirementsResults = await Job.find({
      jobRequirements: { $regex: new RegExp(keyword, "i") },
    });

    const jobResults = [
      ...jobTitleResults,
      ...categoryResults,
      ...locationResultsJob,
      ...detailsResults,
      ...requirementsResults,
    ];

    const clientfullNameResults = await Client.find({
      full_name: { $regex: new RegExp(keyword, "i") },
    });
    const locationResultsClient = await Client.find({
      location: { $regex: new RegExp(keyword, "i") },
    });

    const clientResults = [...clientfullNameResults, ...locationResultsClient];


    res.render("searchResults", {
      results: {
        engineers: engineerResults,
        jobs: jobResults,
        clients: clientResults,
        engineerfullNameResults: engineerfullNameResults,
        designationResults: designationResults,
        locationResultsEngineer: locationResultsEngineer,
        expertiseResults: expertiseResults,
        jobTitleResults: jobTitleResults,
        categoryResults: categoryResults,
        locationResultsJob: locationResultsJob,
        detailsResults: detailsResults,
        requirementsResults: requirementsResults,
        clientfullNameResults: clientfullNameResults,
        locationResultsClient: locationResultsClient,
      },
      user, 
      userId,
      isClient: req.session.user?.role === "Client",  
    isEngineer: req.session.user?.role === "Engineer",
    isAdmin: req.session.user?.role === "Admin"
    });
  } catch (error) {
    console.error("Error in keyword search:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});
