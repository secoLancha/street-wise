const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const nodemailer = require("nodemailer");
app.use(express.json());

require("./db/config");
const Admin = require("./db/admin");
const Vendor = require("./db/vendor");
const User = require("./db/user");
const Invite = require("./db/invite");
const Listing = require("./db/listing");

const secretKey = "JayShankar13";

// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJlbWFpbCI6Im1hbnRoYW4uZGltYmxlQGdtYWlsLmNvbSIsInBhc3N3b3JkIjoiTWFudGhhbkAxMjM0IiwiaWF0IjoxNzQyMTI4NDk4LCJleHAiOjE3NDIzMDEyOTh9.SmmUEb_PX42xc6t1NgExvIB6Qi0Y_2Ap2_3r6G-QedE

function generateInviteId() {
  let dictionary = "abcdefghijklmnopqrstuvwxyz1234567890!@#$%^&*()_+-=";
  let inviteId = "";
  for (var i = 0; i < 30; i++) {
    inviteId =
      inviteId + dictionary[Math.ceil(Math.random() * dictionary.length - 1)];
  }
  return inviteId;
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) return res.status(401).send({ error: "Unauthorized" });

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) return res.status(403).send({ error: "Forbidden" });
    req.user = decoded;
    next();
  });
}

app.post("/admin-signup", async (req, res) => {
  try {
    if (
      req.body &&
      req.body.email &&
      req.body.userName &&
      req.body.password &&
      req.body.phone &&
      req.body.name
    ) {
      let foundAdmin = await Admin.findOne({ email: req.body.email });
      if (foundAdmin) {
        res.send({ error: "Admin already exists!" });
      } else {
        let admin = new Admin(req.body);
        ``;
        let result = await admin.save();
        if (result) {
          let invitePresent = await Invite.find({
            invitedEmail: req.body.email,
          });
          if (invitePresent) {
            await Invite.deleteOne({ invitedEmail: req.body.email });
          }
          res.send({ success: "Signup Successful!" });
        } else {
          res.send({ error: "Something went wrong, please try again !" });
        }
      }
    } else {
      res.send({ error: "Please send all the fields to Signup!" });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
    console.log(error);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    let userFound;

    if (role === "admin") {
      userFound = await Admin.findOne({
        email: email,
        password: password,
      }).select("-password");
    } else if (role === "vendor") {
      userFound = await Vendor.findOne({
        email: email,
        password: password,
      }).select("-password");
    } else if (role === "user") {
      userFound = await User.findOne({
        email: email,
        password: password,
      }).select("-password");
    }

    if (userFound) {
      const token = jwt.sign(req.body, secretKey, { expiresIn: "2d" });
      res.send({
        success: "Login successful!",
        userDetails: userFound,
        jwt: token,
      });
    } else {
      res.send({ error: "No such user found!" });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.get("/get-all-vendors", verifyToken, async (req, res) => {
  try {
    let vendorsList = await Vendor.find().select("-password");
    res.send({
      success: "Vendor's list fetched successfully!",
      vendorsList: vendorsList,
    });
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.get("/get-all-admins", verifyToken, async (req, res) => {
  try {
    let adminsList = await Admin.find().select("-password");
    res.send({
      success: "Admin's list fetched successfully!",
      adminsList: adminsList,
    });
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.post("/send-invite-to/:roleToInvite", verifyToken, async (req, res) => {
  try {
    let info;
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Use `true` for port 465, `false` for all other ports
      auth: {
        user: "manthan8dimble@gmail.com",
        pass: "albc tvtl lzim vqqj",
      },
    });

    const { adminUsername, emailToInvite } = req.body;

    if (req.params.roleToInvite && req.params.roleToInvite !== "") {
      let inviteToAdd = new Invite({
        invitedForRole: req.params.roleToInvite,
        invitedEmail: emailToInvite,
        invitedByAdmin: adminUsername,
        inviteId: generateInviteId(),
      });

      let result = await inviteToAdd.save();

      if (result._id) {
        // invite generated successfully
        if (inviteToAdd.invitedForRole === "admin") {
          info = await transporter.sendMail({
            from: `manthan8dimble@gmail.com`,
            to: inviteToAdd.invitedEmail,
            subject: "Invitation by admin of Street-Wise",
            text: `Admin has invited you as an ADMIN in Street-Wise \n
                      Use the following link to signup! \n
                      http://localhost:3000/signup/${inviteToAdd.invitedForRole}/${inviteToAdd.invitedEmail}/${inviteToAdd.inviteId}
                      `,
          });
        } else if (inviteToAdd.invitedForRole === "vendor") {
          info = await transporter.sendMail({
            from: `manthan8dimble@gmail.com`,
            to: inviteToAdd.invitedEmail,
            subject: "Invitation by admin of Street-Wise",
            text: `Admin has invited you as an VENDOR in Street-Wise \n
                      Use the following link to signup! \n
                      http://localhost:3000/signup/${inviteToAdd.invitedForRole}/${inviteToAdd.invitedEmail}/${inviteToAdd.inviteId}
                      `,
          });
        }

        if (info && info.rejected.length === 0) {
          //Success
          res.send({ success: "Invite sent successfully!" });
        } else {
          res.send({ error: "Error while sending invite!" });
        }
      } else {
        res.send({ error: "Error while generating invite!" });
      }
    } else {
      res.send({ error: "Role of invited user in params is important!" });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.post("/get-my-profile-info-admin", verifyToken, async (req, res) => {
  try {
    let userInfo = await Admin.findOne({ _id: req.body.idOfAdmin });
    if (userInfo) {
      res.send({
        success: "My Profile(Admin) Info fetched successfully!",
        info: userInfo,
      });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.put("/change-admin-password", verifyToken, async (req, res) => {
  try {
    const { updatedPassword, idOfAdmin } = req.body;
    let result = await Admin.updateOne(
      { _id: idOfAdmin },
      { $set: { password: updatedPassword } }
    );
    if (result.acknowledged === true && result.modifiedCount !== 0) {
      res.send({ success: "Password changed successfully!" });
    } else {
      res.send({
        error: "Something went wrong, Please try again or enter new password!",
      });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.put("/edit-vendor", verifyToken, async (req, res) => {
  try {
    const { idOfVendorToEdit, editedData } = req.body;

    if (
      editedData.name &&
      editedData.email &&
      editedData.phone &&
      editedData.userName &&
      editedData.password
    ) {
      let result = await Vendor.updateOne(
        {
          _id: idOfVendorToEdit,
        },
        {
          $set: {
            userName: editedData.userName,
            password: editedData.password,
            name: editedData.name,
            email: editedData.email,
            phone: editedData.phone,
          },
        }
      );

      if (result.acknowledged === true) {
        res.send({ success: "Vendor details updated successfully!" });
      } else {
        res.send({ error: "Error while editing vendor details!" });
      }
    } else {
      res.send({ error: "All the fields are mandatory!" });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.delete("/delete-vendor/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    let result = await Vendor.deleteOne({ _id: id });
    console.log(result);
    if (result) {
      if (result.deletedCount !== 0) {
        res.send({ success: "Vendor deleted successfully!" });
      } else {
        res.send({ error: "Vendor not deleted!" });
      }
    } else {
      res.send({
        error: "Error while deleting vendor, please try again later!",
      });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.put("/edit-admin", verifyToken, async (req, res) => {
  try {
    const { idOfAdminToEdit, editedData } = req.body;

    if (
      editedData.name &&
      editedData.email &&
      editedData.phone &&
      editedData.userName &&
      editedData.password
    ) {
      let result = await Admin.updateOne(
        {
          _id: idOfAdminToEdit,
        },
        {
          $set: {
            userName: editedData.userName,
            password: editedData.password,
            name: editedData.name,
            email: editedData.email,
            phone: editedData.phone,
          },
        }
      );

      if (result.modifiedCount > 0) {
        res.send({ success: "Admin details updated successfully!" });
      } else if (result.matchedCount === 0) {
        res.send({ error: "No admin found with the given ID!" });
      } else {
        res.send({ error: "No changes were made!" });
      }
    } else {
      res.send({ error: "All the fields are mandatory!" });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.delete("/delete-admin/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    let result = await Admin.deleteOne({ _id: id });
    if (result) {
      if (result.deletedCount !== 0) {
        res.send({ success: "Admin deleted successfully!" });
      } else {
        res.send({ error: "Admin not found!" });
      }
    } else {
      res.send({
        error: "Error while deleting admin, please try again later!",
      });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.get("/search-vendors/:searchString", verifyToken, async (req, res) => {
  try {
    let foundVendors = await Vendor.find({
      $or: [
        { userName: { $regex: req.params.searchString, $options: "i" } },
        { name: { $regex: req.params.searchString, $options: "i" } },
      ],
    }).select("-password");

    if(foundVendors)
    {
      res.send({
        success : "Vendors searched successfully!", 
        searchResults : foundVendors});
    }
    else
    {
      res.send({
        error : "Error while searching vendors!"
      });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.get("/search-admins/:searchString", verifyToken, async (req, res) => {
  try {
    let foundAdmins = await Admin.find({
      $or: [
        { userName: { $regex: req.params.searchString, $options: "i" } },
        { name: { $regex: req.params.searchString, $options: "i" } },
      ],
    }).select("-password");

    if(foundAdmins)
    {
      res.send({
        success : "Admins searched successfully!", 
        searchResults : foundAdmins
      });
    }
    else
    {
      res.send({
        error : "Error while searching admins!"
      });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});


//Vendor Dashboard

app.post("/vendor-signup" , verifyToken, async(req,res)=>{
  try {
      let foundVendor = await Vendor.findOne({ email: req.body.email });
      if (foundVendor) {
        res.send({ error: "Vendor email already exists!" });
      } else {
        let vendor = new Vendor(req.body);
        ``;
        let result = await vendor.save();
        if (result) {
          let invitePresent = await Invite.find({
            invitedEmail: req.body.email,
          });
          if (invitePresent) {
            await Invite.deleteOne({ invitedEmail: req.body.email });
          }
          res.send({ success: "Signup Successful!" });
        } else {
          res.send({ error: "Something went wrong, please try again !" });
        }
      }
  } catch (error) {
    res.send({error : error.message});
  }
});

app.post("/add-new-listing" , verifyToken , async(req,res)=>{
  try {
    let listingToAdd = new Listing(req.body);
    let result = await listingToAdd.save();

    if(result._id)
    {
      res.send({success : "Listing added successfully!"});
    }
    else
    {
      res.send({error : "Error while listing your business, please try again later!"});
    }
  } catch (error) {
    res.send({error : error.message});
  }
});

app.get("/fetch-my-listings/:id" , verifyToken , async(req,res)=>{
  try {
    let myListings = await Listing.find({ vendorId: req.params.id });
    if(myListings)
    {
      res.send({
        success : "Listings fetched successfully!",
        listings : myListings
      });
    }
    else
    {
      res.send({
        error : "Error whie fetching my listings"
      });
    }
  } catch (error) {
    res.send({error:error.message});
  }
});

app.put("/edit-listing" , verifyToken , async(req,res)=>{
  try {
    const { idOfListingToEdit, editedData } = req.body;

    
      let result = await Listing.updateOne(
        {
          _id: idOfListingToEdit,
        },
        {
          $set: editedData,
        }
      );

      if (result.modifiedCount > 0) {
        res.send({ success: "Listing details updated successfully!" });
      } else if (result.matchedCount === 0) {
        res.send({ error: "No listing found with the given ID!" });
      } else {
        res.send({ error: "No changes were made!" });
      }
  } catch (error) {
    res.send({error : error.message});
  }
});

app.delete("/delete-listing/:id" , verifyToken , async(req,res)=>{
  try {
    const { id } = req.params;
    let result = await Listing.deleteOne({ _id: id });
    if (result) {
      if (result.deletedCount !== 0) {
        res.send({ success: "Listing deleted successfully!" });
      } 
      else if(result.matchedCount===0)
      {
        res.send({error : "No such listing found!"});
      }
      else {
        res.send({ error: "Error while deleting listing, please try again later!" });
      }
    } else {
      res.send({
        error: "Error while deleting listing, please try again later!",
      });
    }
  } catch (error) {
    res.send({error : error.message});
  }
});

app.get("/fetch-my-profile-vendor/:id" , verifyToken , async(req,res)=>{
  try {
    const {id}= req.params;
    let userData = await Vendor.findOne({ _id : id }).select("-password -__v");
    if(userData)
    {
      res.send({
        success : "Profile Info fetched successfully!",
        profileData : userData
      });
    }
    else
    {
      res.send({error : "error while fetching Profile Data"});
    }
  } catch (error) {
    res.send({error : error.message});
  }
});

app.get("/search-listings/:searchString", verifyToken, async (req, res) => {
  try {
    let foundListings = await Listing.find({
      $or: [
        { businessTitle: { $regex: req.params.searchString, $options: "i" } },
        { businessCategory: { $regex: req.params.searchString, $options: "i" } },
      ],
    });

    if(foundListings)
    {
      res.send({
        success : "Listings searched successfully!", 
        searchResults : foundListings
      });
    }
    else
    {
      res.send({
        error : "Error while searching listings!"
      });
    }
  } catch (error) {
    res.send({ error: error.message });
  }
});

app.listen(5000, (err) => {
  if (err) {
    return;
  }
  console.log("Server running on port 5000");
});
