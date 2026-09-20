const User = require("../models/User");
const FundiProfile = require("../models/FundiProfile");
const { storageFileUrl } = require("../services/gridfsStorage");

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    let fundiProfile = null;
    if (user.role === "fundi" || user.fundiEnabled) {
      fundiProfile = await FundiProfile.findOne({ userId: user._id });
    }
    return res.json({ user, fundiProfile });
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const updates = { ...req.body };
    delete updates.password;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (
      (user.role === "fundi" || user.fundiEnabled) &&
      (req.body.skills ||
        req.body.portfolioImages ||
        req.body.experience !== undefined ||
        req.body.bio)
    ) {
      const fundiUpdate = {
        ...(req.body.skills && { skills: req.body.skills }),
        ...(req.body.portfolioImages && {
          portfolioImages: req.body.portfolioImages,
        }),
        ...(req.body.experience !== undefined && {
          experience: req.body.experience,
        }),
        ...(req.body.bio && { bio: req.body.bio }),
      };
      await FundiProfile.findOneAndUpdate(
        { userId: user._id },
        fundiUpdate,
        { upsert: true, new: true },
      );
    }

    if (req.body.onboardingComplete !== undefined) {
      user.onboardingComplete = Boolean(req.body.onboardingComplete);
      await user.save();
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const {
      lat,
      lng,
      locationLabel,
      address,
      district,
      country,
      searchRadiusKm,
    } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        location: { lat: Number(lat), lng: Number(lng) },
        ...(locationLabel !== undefined && { locationLabel }),
        ...(address !== undefined && { address }),
        ...(district !== undefined && { district }),
        ...(country !== undefined && { country }),
        ...(searchRadiusKm !== undefined && {
          searchRadiusKm: Number(searchRadiusKm),
        }),
      },
      { new: true },
    ).select("-password");

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
};

const uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Create the file URL (Supabase Storage public URL)
    const fileUrl = storageFileUrl("profiles", req.file.filename);

    // Update user's profile photo
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: fileUrl },
      { new: true },
    ).select("-password");

    return res.json({
      user,
      profilePhotoUrl: fileUrl,
    });
  } catch (error) {
    return next(error);
  }
};

const uploadCoverPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileUrl = storageFileUrl("profiles", req.file.filename);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { coverPhoto: fileUrl },
      { new: true },
    ).select("-password");

    return res.json({
      user,
      coverPhotoUrl: fileUrl,
    });
  } catch (error) {
    return next(error);
  }
};

const uploadPortfolioImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const fileUrls = req.files.map((f) => storageFileUrl("portfolio", f.filename));

    const fundiProfile = await FundiProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { portfolioImages: { $each: fileUrls } } },
      { upsert: true, new: true },
    );

    return res.json({
      portfolioImages: fundiProfile.portfolioImages,
      added: fileUrls,
    });
  } catch (error) {
    return next(error);
  }
};

const deletePortfolioImage = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: "imageUrl is required" });
    }

    const fundiProfile = await FundiProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $pull: { portfolioImages: imageUrl } },
      { new: true },
    );

    return res.json({ portfolioImages: fundiProfile.portfolioImages });
  } catch (error) {
    return next(error);
  }
};

const requestVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("role fundiEnabled");
    if (!user || (user.role !== "fundi" && !user.fundiEnabled)) {
      return res.status(403).json({ message: "Only fundi accounts can request verification" });
    }
    const fileUrls = req.files?.length
      ? req.files.map((f) => storageFileUrl("verification", f.filename))
      : [];

    const update = {
      verificationStatus: "pending",
      requestedAt: new Date(),
      ...(fileUrls.length && { verificationDocs: fileUrls }),
    };

    const fundiProfile = await FundiProfile.findOneAndUpdate(
      { userId: req.user._id },
      update,
      { upsert: true, new: true },
    );

    return res.json({ fundiProfile });
  } catch (error) {
    return next(error);
  }
};

const enableFundi = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Already a fundi — nothing to do
    if (user.role === "fundi" || user.fundiEnabled) {
      const fundiProfile = await FundiProfile.findOne({ userId: user._id });
      return res.json({ user, fundiProfile });
    }

    // Mark fundi as enabled for this customer
    user.fundiEnabled = true;
    await user.save();

    // Create a FundiProfile if one doesn't exist yet
    let fundiProfile = await FundiProfile.findOne({ userId: user._id });
    if (!fundiProfile) {
      fundiProfile = await FundiProfile.create({ userId: user._id });
    }

    return res.json({ user, fundiProfile });
  } catch (error) {
    return next(error);
  }
};

const registerPushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ message: "Push token is required" });
    }
    await User.findByIdAndUpdate(req.user._id, {
      pushToken: token.trim(),
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateLocation,
  uploadProfilePicture,
  uploadCoverPhoto,
  uploadPortfolioImages,
  deletePortfolioImage,
  requestVerification,
  enableFundi,
  registerPushToken,
};
