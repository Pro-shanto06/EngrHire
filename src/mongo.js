const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectToDatabase = async () => {
 
  if (mongoose.connection.readyState === 0) {
    try {
      
      const atlasConnectionUri =
        "mongodb+srv://proshantosaha1999:W0ZsFvmK5dmk5ayU@cluster0.hwzdkym.mongodb.net/";

      await mongoose.connect(atlasConnectionUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ssl: true,
      });

      console.log("Connected to MongoDB Atlas");

      //await createAdminUser();

    } catch (error) {
      console.error("MongoDB Connection Error:", error);
    }
  }
};


const createAdminUser = async () => {
  try {
    const adminUsername = "proshanto";
    const adminPassword = "123456"; 

    const adminUser = new Admin({
      full_name: "proshanto",
      email: "proshanto@gmail.com",
      password: adminPassword,
    });

    await adminUser.save();

    console.log("Admin user created successfully");
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
};


const adminSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: "Admin",
  },
});



const engineerSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
  },
  designation: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  field_of_expertise: {
    type: String,
    required: true,
  },
  location: {
    type: String,
  },
  website: {
    type: String,
  },
  github: {
    type: String,
  },
  twitter: {
    type: String,
  },
  instagram: {
    type: String,
  },
  facebook: {
    type: String,
  },
  skill: {
    type: String,
  },
  experience: {
    type: String,
  },
  education: {
    type: String,
  },
  address: {
    type: String,
  },
  profilePicPath: {
    type: String, 
  },


  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
});

const jobSchema = new mongoose.Schema({
  jobTitle: {
    type: String,
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client", 
  },

  clientName: {
    type: String,
  },

  category: {
    type: String,
    required: true,
  },
  specifiedCategory: {
    type: String,
  },
  jobDetails: {
    type: String,
    required: true,
  },
  jobRequirements: {
    type: String,
    required: true,
  },
  jobLocation: {
    type: String,
    required: true,
  },
  jobDeadline: {
    type: Date, 
    required: true,
  },
  jobPriceRange: {
    type: String,
    required: true,
  },
  
});

const clientSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  website: {
    type: String, 
  },
  twitter: {
    type: String, 
  },
  instagram: {
    type: String, 
  },
  facebook: {
    type: String, 
  },
  address: {
    type: String, 
  },
  profilePicPath: {
    type: String, 
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

const bidSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
  },
  engineer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engineer",
    required: true,
  },

  client: {
    type: String,
  },

  engineerFullName: {
    type: String,
  },
  jobTitle: {
    type: String,
  },
  jobDeadline: {
    type: Date,
  },

  bidAmount: {
    type: Number,
    required: true,
  },
  bidDetails: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending", 
  },
  
});

const workSchema = new mongoose.Schema({
  engineer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engineer",
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
  },
  bid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bid",
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },

  clientChatMessages: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
      },
      message: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  engineerChatMessages: [
    {
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Engineer",
      },
      message: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});



engineerSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});

clientSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});

adminSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 8);
  }
  next();
});





const Engineer = mongoose.model("Engineer", engineerSchema);
const Job = mongoose.model("Job", jobSchema);

const Bid = mongoose.model("Bid", bidSchema);
const Work = mongoose.model("Work", workSchema);

const Client = mongoose.model("Client", clientSchema);
const Admin = mongoose.model("Admin", adminSchema);

module.exports = { Job, Engineer, Client, Bid, Work,Admin,connectToDatabase };
