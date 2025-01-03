import Notification from "../models/notification.model.js";
import {v2 as cloudinary} from "cloudinary";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs"


export const  getUserProfile = async (req,res) => {
    const {username} = req.params;

    try {
        const user = await User.findOne({username}).select("-password");
        if(!user){
            return res.status(404).json({message: "user not found"});
        }
        res.status(200).json(user);
    } catch (error) {
        console.log("error in getuserprofile: ", error.message);
        res.status(500).json({error:error.message});
    }
}

export const followUnfollowUser = async (req,res) => {
    try {
        const { id } = req.params;
        const userToModify = await User.findById(id);
        const currentUser =  await User.findById(req.user._id)

        if(id === req.user._id.toString()) {
            return res.status(400).json({ error: "You can't follow/unfollow yourself"});
        }
        if (!userToModify || !currentUser) return res.status(400).json({ error: "user not found "});

        const isFollowing = currentUser.following.includes(id);

        if(isFollowing){
            //unfollow the user
            await User.findByIdAndUpdate(id, {$pull: { followers: req.user._id }});
            await User.findByIdAndUpdate(req.user._id, {$pull: { following: id}});
            return res.status(200).json({message: "user unfollowed successfully"});

        }else{
            //follow the user 
            await User.findByIdAndUpdate(id, {$push: { followers: req.user._id}});
            await User.findByIdAndUpdate(req.user._id, { $push: { following: id}})

            const newNotification = new Notification({
                type: "follow",
                from: req.user._id,
                to: userToModify._id,
            });

            await newNotification.save();
            console.log("Notification saved successfully!");

            return res.status(200).json({message: "user followed successfully"});
        }
    } catch (error) {
        res.status(500).json({error:error.message});
        console.log("error in followUnfollowUser: ", error.message);
    }
}

export const getSuggestedUsers = async (req,res) => {

    try {
        const userId = req.user._id;

        const usersFollowedByMe = await User.findById(userId).select("following");

        const users = await User.aggregate([
            {
                $match:{
                    _id: {$ne: userId}
                }
            },
            {$sample: {size: 10}}
        ])

        const filteredUsers = users.filter(user => !usersFollowedByMe.following.includes(user._id));
        const suggestedUsers = filteredUsers.slice(0,4);

        suggestedUsers.forEach((user) => {user.password = null})

        res.status(200).json(suggestedUsers);
    } catch (error) {
        console.log("error in getSuggestedUsers: ", error.message);
        res.status(500).json({error: error.message});
        
    }
}
export const updateUser = async (req, res) => {
    let { fullName, username, currentPassword, newPassword, email, bio, link } = req.body;
    let { profileImg, coverImg } = req.body;

    const userId = req.user._id;

    try {
        // Fetch the user from the database
        let user = await User.findById(userId); // Assuming your model is named User
        if (!user) return res.status(404).json({ message: "User not found" });

        // Validate passwords
        if ((!newPassword && currentPassword) || (!currentPassword && newPassword)) {
            return res.status(400).json({ error: "Please provide both current password and new password" });
        }

        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });
            if (newPassword.length < 6) {
                return res.status(400).json({ error: "Password must be at least 6 characters long" });
            }

            const salt = await bcrypt.genSalt(10); // Correct usage of bcrypt salt generation
            user.password = await bcrypt.hash(newPassword, salt);
        }

        // Handle profile image upload
        if (profileImg) {
            if (user.profileImg) {
                await cloudinary.uploader.destroy(user.profileImg.split("/").pop().split(".")[0]);
            }
            const uploadedResponse = await cloudinary.uploader.upload(profileImg);
            profileImg = uploadedResponse.secure_url;
        }

        // Handle cover image upload
        if (coverImg) {
            if (user.coverImg) {
                await cloudinary.uploader.destroy(user.coverImg.split("/").pop().split(".")[0]);
            }
            const uploadedResponse = await cloudinary.uploader.upload(coverImg);
            coverImg = uploadedResponse.secure_url;
        }

        // Update user fields
        user.fullName = fullName || user.fullName;
        user.email = email || user.email;
        user.username = username || user.username;
        user.bio = bio || user.bio;
        user.link = link || user.link;
        user.profileImg = profileImg || user.profileImg;
        user.coverImg = coverImg || user.coverImg;

        // Save updated user
        user = await user.save();

        user.password = null; // Remove password from response

        return res.status(200).json(user);

    } catch (error) {
        console.error("Error in updateUser:", error.message);
        res.status(500).json({ error: error.message });
    }
};

