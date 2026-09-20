import api from "./api";

export const getProfile = () => api.get("/users/profile");

export const updateProfile = (payload) => api.put("/users/update", payload);

export const updateUserLocation = (payload) =>
  api.put("/users/location", payload);

// Upload profile picture
export const uploadProfilePicture = (formData) => {
  return api.post("/users/profile-picture", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const uploadCoverPicture = (formData) => {
  return api.post("/users/cover-picture", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// Upload portfolio images (fundi)
export const uploadPortfolioImages = (formData) => {
  // Let Axios set multipart/form-data and its boundary. Supplying the header
  // ourselves can omit the boundary on some React Native transports, leaving
  // Multer unable to read the selected images.
  return api.post("/users/portfolio/upload", formData, { timeout: 30000 });
};

// Delete a portfolio image by its stored URL (fundi)
export const deletePortfolioImage = (imageUrl) => {
  return api.delete("/users/portfolio/image", { data: { imageUrl } });
};

// Fundi-specific location update for current GPS location
export const updateFundiLocation = (lat, lng) =>
  api.put("/bookings/fundi/location", { lat, lng });

// Enable fundi mode for a client account
export const enableFundi = () => api.post("/users/enable-fundi");

// Update fundi availability status
export const updateFundiAvailability = (isAvailable, availableForNegotiation) =>
  api.put("/bookings/fundi/availability", { isAvailable, availableForNegotiation });

// Submit identity verification documents (fundi)
export const requestVerification = (formData) => {
  return api.post("/users/verification-request", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// In-app notification feed (the bell)
export const getMyNotifications = () => api.get("/users/notifications");

export const getUnreadNotificationCount = () =>
  api.get("/users/notifications/unread-count");

export const markNotificationRead = (id) =>
  api.patch(`/users/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  api.patch("/users/notifications/read-all");
