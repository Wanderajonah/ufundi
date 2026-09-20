import React, { useState, useRef, useEffect } from "react";
import { View, StatusBar, Alert, BackHandler, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import theme from "./app/theme";

import SplashScreen from "./app/screens/SplashScreen";
import OnboardingScreen from "./app/screens/OnboardingScreen";

import CreateAccountChoiceScreen from "./app/screens/CreateAccountChoiceScreen";

import PhoneRegisterScreen from "./app/screens/PhoneRegisterScreen";
import SignInScreen from "./app/screens/SignInScreen";
import FundiProfileSetupScreen from "./app/screens/FundiProfileSetupScreen";
import OtpScreen from "./app/screens/OtpScreen";
import LocationPermissionScreen from "./app/screens/LocationPermissionScreen";
import SetLocationScreen from "./app/screens/SetLocationScreen";
import HomeScreen from "./app/screens/HomeScreen";
import BrowseArtisansScreen from "./app/screens/BrowseArtisansScreen";
import FundiDashboardScreen from "./app/screens/FundiDashboardScreen";
import ArtisanProfileScreen from "./app/screens/ArtisanProfileScreen";
import RequestServiceScreen from "./app/screens/RequestServiceScreen";
import PaymentScreen from "./app/screens/PaymentScreen";
import BookingConfirmationScreen from "./app/screens/BookingConfirmationScreen";
import LiveTrackingScreen from "./app/screens/LiveTrackingScreen";
import JobInProgressScreen from "./app/screens/JobInProgressScreen";
import RateExperienceScreen from "./app/screens/RateExperienceScreen";
import BookingHistoryScreen from "./app/screens/BookingHistoryScreen";
import BookingsScreen from "./app/screens/BookingsScreen";
import ChatScreen from "./app/screens/ChatScreen";
import NotificationsScreen from "./app/screens/NotificationsScreen";
import ProfileScreen from "./app/screens/ProfileScreen";
import EditProfileScreen from "./app/screens/EditProfileScreen";
import VerificationScreen from "./app/screens/VerificationScreen";
import SettingsScreen from "./app/screens/SettingsScreen";
import RolePickerScreen from "./app/screens/RolePickerScreen";
import PaymentMethodsScreen from "./app/screens/PaymentMethodsScreen";
import HelpSupportScreen from "./app/screens/HelpSupportScreen";
import WalletHomeScreen from "./app/screens/WalletHomeScreen";
import DepositScreen from "./app/screens/DepositScreen";
import WithdrawScreen from "./app/screens/WithdrawScreen";
import TransactionHistoryScreen from "./app/screens/TransactionHistoryScreen";
import TransferScreen from "./app/screens/TransferScreen";
import {
  sendOtp,
  verifyOtpRegister,
  verifyOtpLogin,
  sendGoogleEmailLoginOtp,
  verifyEmailLoginOtp,
  selectRole,
  applyAuthSession,
  clearAuthSession,
  restoreAuthSession,
  getErrorMessage,
  normalizeUgandaPhone,
} from "./services/authApi";
import { setAuthToken as setApiAuthToken } from "./services/api";
// Push notifications disabled — import kept as no-op stub
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "./services/pushService";
import { getProfile } from "./services/usersApi";
import {
  createReview,
  updateReview,
  getMyReviews,
  getErrorMessage as reviewError,
} from "./services/reviewsApi";
import { defaultActiveJob, buildBookingFromRequest } from "./app/utils/ratings";
import BookingWaitingScreen from "./app/screens/BookingWaitingScreen";
import FundiBookingDetailScreen from "./app/screens/FundiBookingDetailScreen";
import FundiNavigationScreen from "./app/screens/FundiNavigationScreen";
import SkillsPortfolioScreen from "./app/screens/SkillsPortfolioScreen";
import BottomNav from "./app/components/BottomNav";
import FloatingSupportChat from "./app/components/FloatingSupportChat";
import { LocationProvider, useLocation } from "./context/LocationContext";
import { BookingProvider } from "./context/BookingContext";
import BookingToast from "./app/components/BookingToast";
import { ChatProvider } from "./context/ChatContext";
import { LanguageProvider } from "./app/i18n/LanguageContext";
import { NotificationProvider } from "./context/NotificationContext";

/** Screens only clients should use (browse, book, pay). */

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
const CLIENT_ONLY_SCREENS = new Set([
  "home",
  "browse",
  "artisan",
  "request",
  "bookingWaiting",
  "payment",
  "confirm",
  "tracking",
  "jobInProgress",
  "rateExperience",
  "bookingHistory",
]);

function AppContent() {
  const [screen, setScreen] = useState("splash");
  const [userRole, setUserRole] = useState("customer");
  const userRoleRef = useRef("customer");
  const [userName, setUserName] = useState("");
  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [fundiEnabled, setFundiEnabled] = useState(false);
  const [pendingRole, setPendingRole] = useState("customer");
  const [selectedRole, setSelectedRole] = useState("");
  const [googleNewUserProfile, setGoogleNewUserProfile] = useState(null);
  const [googleNewUserOrigin, setGoogleNewUserOrigin] = useState("signin");

  const [signupData, setSignupData] = useState(null);
  const [otpPurpose, setOtpPurpose] = useState("register");
  const [otpPhone, setOtpPhone] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [googleOtpToken, setGoogleOtpToken] = useState("");
  const [otpChannel, setOtpChannel] = useState("phone");
  const [otpExpiresIn, setOtpExpiresIn] = useState(600);
  const [otpDevCode, setOtpDevCode] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [pendingUsers, setPendingUsers] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [browseCategory, setBrowseCategory] = useState("all");
  const [selectedArtisan, setSelectedArtisan] = useState(null);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [editingReview, setEditingReview] = useState(null);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState("");
  // simple navigation history stack (stores previous screen keys)
  const historyRef = useRef([]);
  const {
    ensureLocationForLogin,
    setAuthTokenForSync,
    setManualLocation,
    coords,
  } = useLocation();
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [verificationFromSetup, setVerificationFromSetup] = useState(false);
  const [clientBookingDraft, setClientBookingDraft] = useState(null);
  const [chatTargetUserId, setChatTargetUserId] = useState(null);

  // push current screen into history and navigate
  const pushAndNavigate = (next) => {
    // don't push if same as current
    if (screen && screen !== next) {
      historyRef.current.push(screen);
    }
    setScreen(next);
  };

  const goHome = (role = userRole) => {
    // reset history when going to home/dashboard
    historyRef.current = [];
    // Dual-role users (customer + fundiEnabled) always go to client home
    if (fundiEnabled && role === "customer") {
      setScreen("home");
    } else {
      setScreen(role === "fundi" ? "fundiDashboard" : "home");
    }
  };

  // Switch a dual-role (fundi-enabled) user into fundi mode. The active role
  // must reflect the chosen view so tabs/dashboard/booking scoping are correct.
  const verifyFundiActivation = async () => {
    try {
      const { data } = await getProfile();
      return data?.fundiProfile?.verificationStatus === "verified";
    } catch {
      return false;
    }
  };

  const switchToFundiMode = async () => {
    if (!(await verifyFundiActivation())) {
      setScreen("verification");
      return;
    }
    historyRef.current = [];
    setUserRole("fundi");
    setScreen("fundiDashboard");
  };

  // Switch a dual-role (fundi-enabled) user back into client mode.
  const switchToClientMode = () => {
    historyRef.current = [];
    setUserRole("customer");
    setScreen("home");
  };

  const handleLogout = async () => {
    // Clear API token and local auth state
    try {
      await clearAuthSession();
      setApiAuthToken("");
    } catch (e) {
      // ignore
    }
    setAuthToken("");
    setAuthTokenForSync("");
    setUserName("");
    setUserFullName("");
    setUserEmail("");
    setUserId("");
    setUserRole("customer");
    setFundiEnabled(false);
    setPendingUsers(null);
    historyRef.current = [];
    setScreen("onboarding");
  };

  const proceedAfterLogin = async (data, role) => {
    if (role === "fundi" && !data.user?.onboardingComplete) {
      setScreen("fundiProfileSetup");
      return;
    }
    setScreen("locationPermission");
  };

  const afterAuth = async (data) => {
    const role = await applySession(data);
    setAuthTokenForSync(data.token || "");
    const locationOk = await ensureLocationForLogin();
    if (!locationOk) {
      Alert.alert(
        "Location required",
        "Ufundi needs location access to show nearby services.",
      );
      handleLogout();
      return role;
    }
    await proceedAfterLogin(data, role);
    return role;
  };

  // Finish a login/OTP/role-selection flow. Location is only mandatory during
  // registration; here we trust the backend flag: if the user already has a
  // saved location (lat/lng), reuse it and skip the device location gate so
  // returning users can still log in on emulators without GPS/services.
  const finishLogin = async (data, role) => {
    setAuthTokenForSync(data.token || "");
    const saved = data.user;
    if (
      saved?.locationConfigured &&
      saved?.location &&
      Number(saved.location.lat) !== 0 &&
      Number(saved.location.lng) !== 0
    ) {
      await setManualLocation(
        saved.location.lat,
        saved.location.lng,
        saved.locationLabel || undefined,
      );
      if (role === "fundi" && !(await verifyFundiActivation())) {
        setScreen("verification");
      } else {
        goHome(role);
      }
      return;
    }
    const locationOk = await ensureLocationForLogin();
    if (!locationOk) {
      Alert.alert(
        "Location required",
        "Ufundi needs location access to show nearby services.",
      );
      handleLogout();
      return;
    }
    if (role === "fundi" && !(await verifyFundiActivation())) {
      setScreen("verification");
    } else {
      goHome(role);
    }
  };

  const applySession = async (data) => {
    await applyAuthSession(data);
    setAuthToken(data.token || "");
    setUserId(data.user?.id || data.user?._id || "");
    setUserName(
      data.user?.firstName || data.user?.name?.split(" ")[0] || "User",
    );
    setUserFullName(data.user?.name || "");
    setUserEmail(data.user?.email || "");
    const role = data.user?.role || "customer";
    setUserRole(role);
    setFundiEnabled(Boolean(data.user?.fundiEnabled));
    return role;
  };

  const handleNavigate = (key, params) => {
    // Pure fundis cannot access client-only screens
    if (userRole === "fundi" && !fundiEnabled && CLIENT_ONLY_SCREENS.has(key)) {
      Alert.alert(
        "Client feature",
        "Browsing artisans and booking jobs are for clients. Use your Fundi dashboard and Jobs tab.",
      );
      return;
    }
    // Customers without fundi mode cannot access fundi dashboard
    if (userRole === "customer" && !fundiEnabled && key === "fundiDashboard") {
      return setScreen("home");
    }

    if (key === "home") return goHome();
    if (key === "fundiDashboard") return pushAndNavigate("fundiDashboard");
    if (key === "browse") {
      if (params?.category) setBrowseCategory(params.category);
      return pushAndNavigate("browse");
    }
    if (key === "bookings") return setScreen("bookings");
    if (key === "profile") return setScreen("profile");
    if (key === "chat") {
      if (params?.targetUserId) setChatTargetUserId(params.targetUserId);
      return setScreen("chat");
    }
    if (key === "notifications") return setScreen("notifications");
    if (key === "editProfile") return setScreen("editProfile");
    if (key === "skillsPortfolio") return setScreen("skillsPortfolio");
    if (key === "settings") return setScreen("settings");
    if (key === "payments") return setScreen("payments");
    if (key === "wallet") return setScreen("wallet");
    if (key === "deposit") return setScreen("deposit");
    if (key === "withdraw") return setScreen("withdraw");
    if (key === "transfer") return setScreen("transfer");
    if (key === "transactionHistory") return setScreen("transactionHistory");
    if (key === "help") return setScreen("help");
    if (key === "verification") {
      setVerificationFromSetup(false);
      return setScreen("verification");
    }
    if (key === "createAccount") return setScreen("createAccount");
    if (key === "signIn") {
      if (!selectedRole) {
        setSelectedRole("client");
        setPendingRole("client");
      }
      return setScreen("signIn");
    }
    if (key === "tracking") return pushAndNavigate("tracking");
    if (key === "jobInProgress") {
      if (params?.job) setActiveJob(params.job);
      else if (!activeJob) {
        setActiveJob(defaultActiveJob(pendingBooking, selectedArtisan || {}));
      }
      return pushAndNavigate("jobInProgress");
    }
    if (key === "rateExperience") {
      if (params?.job) setActiveJob(params.job);
      // If no explicit review was passed, check if we already have one for
      // this fundi so the screen can offer "Update review" instead of creating
      // a duplicate.
      if (params?.review) {
        setEditingReview(params.review);
      } else if (!editingReview) {
        const job = params?.job || activeJob;
        const fundiId = job?.fundiId || job?.fundi;
        const existing = findExistingReviewForFundi(reviewHistory, fundiId);
        setEditingReview(existing || null);
      }
      return pushAndNavigate("rateExperience");
    }
    if (key === "bookingHistory") return pushAndNavigate("bookingHistory");
    if (key === "payment") {
      if (params?.booking) {
        setPendingBooking(params.booking);
        setActiveJob(
          defaultActiveJob(
            params.booking,
            params.booking.artisan || selectedArtisan || {},
          ),
        );
      }
      return pushAndNavigate("payment");
    }

    if (key === "book") return pushAndNavigate("request");
    if (key === "artisan") {
      if (params?.artisan) setSelectedArtisan(params.artisan);
      return pushAndNavigate("artisan");
    }
    if (key === "request") {
      if (params?.artisan) setSelectedArtisan(params.artisan);
      return pushAndNavigate("request");
    }
    if (key === "confirm") {
      if (params?.booking) setPendingBooking(params.booking);
      setActiveJob(
        defaultActiveJob(
          params?.booking || pendingBooking,
          selectedArtisan || {},
        ),
      );
      return pushAndNavigate("confirm");
    }
    if (key === "bookingWaiting") {
      if (params?.booking) {
        setClientBookingDraft(params.booking);
        setPendingBooking(params.booking);
      }
      return pushAndNavigate("bookingWaiting");
    }
    if (key === "fundiBookingDetail") {
      if (params?.bookingId) setSelectedBookingId(params.bookingId);
      return pushAndNavigate("fundiBookingDetail");
    }
    if (key === "fundiNavigation") {
      if (params?.bookingId) setSelectedBookingId(params.bookingId);
      return pushAndNavigate("fundiNavigation");
    }
  };

  const bookingWrap = (el) => (
    <BookingProvider
      userId={userId}
      authToken={authToken}
      userRole={userRole}
      fundiCoords={coords}
      onNavigate={handleNavigate}
    >
      <View style={{ flex: 1 }}>
        {el}
        <BookingToast visible={!["bookingWaiting", "fundiBookingDetail"].includes(screen)} />
      </View>
    </BookingProvider>
  );

  // Bottom tab bar layout: content on top, dark navbar pinned to the bottom.
  const tabLayout = (el, active) => (
    <View style={{ flex: 1 }}>
      {el}
      <BottomNav
        active={active}
        role={userRole}
        onNavigate={(key) => {
          if (key === "home") {
            goHome();
            return;
          }
          if (key === "chat") setChatTargetUserId(null);
          historyRef.current = [];
          setScreen(key);
        }}
      />
      {authToken && userId && userRole !== "fundi" ? (
        <FloatingSupportChat userId={userId} onNavigate={handleNavigate} />
      ) : null}
    </View>
  );

  // Clear chat target when leaving chat screen
  useEffect(() => {
    if (screen !== "chat") setChatTargetUserId(null);
  }, [screen]);

  // Keep userRoleRef in sync so notification listener can read the latest role
  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  // Keep the Android system navigation bar in sync with the dark theme.
  // The app runs edge-to-edge, so the nav bar is transparent and Android paints
  // the app's background behind it. The background color is handled natively via
  // Edge-to-edge is mandatory in SDK 57/Android 16. The OS owns the nav bar
  // color; we only control button contrast via setStyle.
  useEffect(() => {
    if (Platform.OS === "android") {
      try { NavigationBar.setStyle?.("light"); } catch {}
      SystemUI.setBackgroundColorAsync?.("#000000")?.catch?.(() => {});
    }
  }, []);

  // Handle Android hardware back button by popping history
  useEffect(() => {
    const onBackPress = () => {
      const h = historyRef.current;
      if (h.length === 0) {
        // if at root screens like home/onboarding/splash, let system handle it (exit)
        if (
          screen === "home" ||
          screen === "fundiDashboard" ||
          screen === "onboarding" ||
          screen === "splash" ||
          screen === "createAccount" ||
          screen === "signIn"
        ) {
          return false; // allow default behavior
        }
        // otherwise, go home
        goHome();
        return true;
      }
      const prev = h.pop();
      historyRef.current = h;
      setScreen(prev || "home");
      return true; // handled
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => {
      // use the subscription remove() method which is the supported API
      if (sub && typeof sub.remove === "function") sub.remove();
    };
  }, [screen]);

  const findExistingReviewForFundi = (reviewList, fundiId) => {
    if (!fundiId) return null;
    const normalized = String(fundiId);
    const match = (r) => {
      const rid =
        r.fundiId?._id || r.fundi?._id || r._id || r.fundiId || r.fundi;
      return String(rid || "") === normalized;
    };
    return (
      (reviewList || []).find(
        (r) =>
          match(r) &&
          (r.reviewId || r._id || r.id) &&
          !String(r.reviewId || r._id || r.id).startsWith("demo") &&
          !String(r.reviewId || r._id || r.id).startsWith("local-"),
      ) || null
    );
  };

  const handleJobComplete = async (job) => {
    const completed = {
      ...job,
      status: "completed",
      releasedAt: Date.now(),
    };
    setActiveJob(completed);

    // Look for an existing review for this fundi so the screen offers an
    // "Update review" flow instead of creating a duplicate. Search both the
    // in-memory history and a fresh fetch (covers cold starts where the
    // cached list is empty) so re-hiring the same fundi reliably edits.
    const fundiId = job.fundiId || job.fundi;
    let existingForFundi = findExistingReviewForFundi(reviewHistory, fundiId);
    if (!existingForFundi && authToken) {
      try {
        const { data } = await getMyReviews();
        if (Array.isArray(data) && data.length) {
          const normalized = String(fundiId);
          const fresh = data.find(
            (r) => String(r.fundiId?._id || r.fundi || r.fundiId || "") === normalized,
          );
          if (fresh) {
            existingForFundi = {
              id: fresh._id,
              reviewId: fresh._id,
              fundiId: fresh.fundiId?._id || fresh.fundiId,
              fundiName: fresh.fundiId?.name || job.fundiName || "Fundi",
              service: fresh.service || job.service,
              amount: fresh.amount || job.amount,
              rating: fresh.rating,
              comment: fresh.comment,
              photoUrls: fresh.photoUrls || [],
              date: fresh.updatedAt || fresh.createdAt,
            };
          }
        }
      } catch {
        // fall back to whatever state we have
      }
    }

    setEditingReview(existingForFundi || null);
    pushAndNavigate("rateExperience");
  };

  const handleReviewSubmit = async ({
    rating,
    comment,
    photoUrls,
    reviewId,
  }) => {
    const job = activeJob || defaultActiveJob(pendingBooking, selectedArtisan);
    const payload = {
      fundiId: job.fundiId,
      rating,
      comment,
      photoUrls,
      jobId: String(job.id).startsWith("demo") ? undefined : job.id,
      service: job.service,
      amount: job.amount,
    };

    let saved;
    try {
      if (authToken) {
        const isLocal = (id) =>
          !id ||
          String(id).startsWith("demo") ||
          String(id).startsWith("local-");
        if (reviewId && !isLocal(reviewId)) {
          const { data } = await updateReview(reviewId, {
            rating,
            comment,
            photoUrls,
          });
          saved = data;
        } else if (!reviewId) {
          const { data } = await createReview(payload);
          saved = data;
        }
      }
    } catch (error) {
      Alert.alert("Review not saved", reviewError(error));
      return;
    }

    const entry = {
      id: saved?._id || reviewId || `local-${Date.now()}`,
      reviewId: saved?._id || reviewId || `local-${Date.now()}`,
      fundiName: job.fundiName,
      service: job.service,
      amount: job.amount,
      date: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      rating,
      comment,
      photoUrls,
      job,
    };

    setReviewHistory((prev) => {
      const idx = prev.findIndex(
        (b) => b.reviewId === entry.reviewId || b.id === entry.id,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...entry };
        return next;
      }
      return [entry, ...prev.filter((b) => b.id !== "past-1")];
    });

    setReviewSuccessMessage(
      reviewId
        ? `Your review for ${job.fundiName.split(" ")[0]} was updated.`
        : `Your review for ${job.fundiName.split(" ")[0]} was submitted.`,
    );
    setEditingReview(null);
    pushAndNavigate("bookingHistory");
  };

  const loadReviewHistory = async () => {
    if (!authToken) return;
    try {
      const { data } = await getMyReviews();
      if (Array.isArray(data) && data.length) {
        setReviewHistory(
          data.map((r) => ({
            id: r._id,
            reviewId: r._id,
            fundiName: r.fundiId?.name || "Fundi",
            service: r.service || "Service",
            amount: r.amount || 0,
            date: r.createdAt,
            rating: r.rating,
            comment: r.comment,
            photoUrls: r.photoUrls || [],
            fundiId: r.fundiId?._id || r.fundiId,
          })),
        );
      }
    } catch {
      /* keep local/demo history */
    }
  };

  useEffect(() => {
    if (authToken) loadReviewHistory();
  }, [authToken]);

  // Re-hydrate auth after reloads when AsyncStorage still has a valid token
  useEffect(() => {
    if (authToken) return;
    let cancelled = false;
    (async () => {
      const session = await restoreAuthSession();
      if (cancelled || !session?.user) return;
      await applySession(session);
      setAuthTokenForSync(session.token);
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const tabProps = {
    userRole,
    userName,
    userFullName,
    userEmail,
    userId,
    authToken,
    fundiEnabled,
    onNavigate: handleNavigate,
    onSwitchToFundiMode: switchToFundiMode,
    onSwitchToClientMode: switchToClientMode,
    activeJob,
  };
  const tabPropsWithLogout = { ...tabProps, onLogout: handleLogout };

  // Screen switch wrapped by NotificationProvider so every screen (and the
  // persistent socket listener) has access to the notification feed.
  const renderScreen = () => {

  if (screen === "splash") {
    return (
      <SplashScreen
        onFinish={async () => {
          try {
            const session = await restoreAuthSession();
            if (session?.user) {
              const role = await applySession(session);
              setAuthTokenForSync(session.token);
              if (role === "fundi" && !(await verifyFundiActivation())) {
                setScreen("verification");
              } else {
                goHome(role);
              }
              return;
            }
          } catch {
            /* show onboarding */
          }
          setScreen("onboarding");
        }}
      />
    );
  }

  if (screen === "onboarding") {
    return (
      <OnboardingScreen
        onSelectRole={(role) => {
          setSelectedRole(role === "customer" ? "client" : role);
          setPendingRole(role === "customer" ? "client" : role);
          setGoogleNewUserProfile(null);
          setGoogleNewUserOrigin("signin");
          setScreen("signIn");
        }}
      />
    );
  }

  if (screen === "createAccountChoice") {
    if (!selectedRole) return setScreen("onboarding");
    return (
      <CreateAccountChoiceScreen
        role={selectedRole}
        initialProfile={googleNewUserProfile || null}
        onBack={() => setScreen("signIn")}
        onPhoneContinue={({ firstName, lastName, email, role }) => {
          setSignupData({
            role: role || selectedRole,
            firstName,
            lastName,
            email,
            name: `${firstName || ""} ${lastName || ""}`.trim(),
          });
          setOtpPurpose("register");
          setScreen("phoneRegister");
        }}
        onGoogleContinue={({ firstName, lastName, email, role }) => {
          setSignupData({
            role: role || selectedRole,
            firstName,
            lastName,
            email,
            name: `${firstName || ""} ${lastName || ""}`.trim(),
          });

          // Preserve captured fields, then start Google OAuth.
          setGoogleNewUserProfile({ firstName, lastName, email });
          setGoogleNewUserOrigin("createAccountChoice");
          setScreen("signIn");
        }}
      />
    );
  }

  if (screen === "createAccount") {
    // CreateAccountScreen.js is the ConfirmDetails UI.
    if (!selectedRole) return setScreen("onboarding");
    return (
      <CreateAccountScreen
        role={selectedRole}
        googleProfile={googleNewUserProfile || {}}
        onBack={() =>
          setScreen(
            googleNewUserOrigin === "createAccountChoice"
              ? "createAccountChoice"
              : "signIn",
          )
        }
        onConfirm={async (profile) => {
          const { registerAccount } = await import("./services/authApi");
          const { data } = await registerAccount(profile);
          await afterAuth(data);
        }}
      />
    );
  }

  if (screen === "phoneRegister") {
    return (
      <PhoneRegisterScreen
        submitting={signupSubmitting}
        onBack={() => setScreen("createAccountChoice")}
        onSend={async (phone) => {
          try {
            setSignupSubmitting(true);
            const normalized = normalizeUgandaPhone(phone);
            setOtpPhone(normalized);
            const { data: otpRes } = await sendOtp(normalized, "register");
            setOtpExpiresIn(otpRes.expiresIn || 600);
            if (otpRes.devCode) setOtpDevCode(otpRes.devCode);
            setScreen("otp");
          } catch (error) {
            Alert.alert("Could not send OTP", getErrorMessage(error));
          } finally {
            setSignupSubmitting(false);
          }
        }}
      />
    );
  }

  if (screen === "signIn") {
    // hard safety: do not allow reaching sign-in without role selected
    if (!selectedRole) {
      return (
        <OnboardingScreen
          onSelectRole={(role) => {
            setSelectedRole(role === "customer" ? "client" : role);
            setPendingRole(role === "customer" ? "client" : role);
            setGoogleNewUserProfile(null);
            setGoogleNewUserOrigin("signin");
            setScreen("signIn");
          }}
        />
      );
    }
    return (
      <SignInScreen
        role={selectedRole}
        onBack={() => setScreen("onboarding")}
        onCreateAccount={() => setScreen("createAccountChoice")}
        onPhoneOtp={async ({ phone }) => {
          if (!selectedRole) {
            setScreen("onboarding");
            return;
          }

          try {
            setOtpChannel("phone");
            setOtpPurpose("login");
            const normalized = normalizeUgandaPhone(phone);
            setOtpPhone(normalized);
            const { data } = await sendOtp(normalized, "login");
            setOtpExpiresIn(data.expiresIn || 600);
            if (data.devCode) setOtpDevCode(data.devCode);
            setScreen("otp");
          } catch (error) {
            Alert.alert("Could not send OTP", getErrorMessage(error));
          }
        }}
        onGoogleEmailOtp={async ({ idToken }) => {
          try {
            setOtpChannel("email");
            setOtpPurpose("login");
            setGoogleOtpToken(idToken);
            const { data } = await sendGoogleEmailLoginOtp(idToken);
            setOtpEmail(data.email);
            setOtpExpiresIn(data.expiresIn || 600);
            if (data.devCode) setOtpDevCode(data.devCode);
            setScreen("otp");
          } catch (error) {
            Alert.alert("Could not send email code", getErrorMessage(error));
          }
        }}
      />
    );
  }

  if (screen === "fundiProfileSetup") {
    return (
      <FundiProfileSetupScreen
        authToken={authToken}
        onBack={() => setScreen("createAccount")}
        onComplete={() => {
          setVerificationFromSetup(true);
          setScreen("verification");
        }}
      />
    );
  }

  if (screen === "otp") {
    const displayPhone = otpChannel === "email"
      ? otpEmail
      : otpPhone
      ? `+256 ${otpPhone.replace(/\D/g, "").replace(/^256/, "")}`
      : "+256";
    return (
      <OtpScreen
        phone={displayPhone}
        phoneRaw={otpChannel === "email" ? otpEmail : otpPhone}
        purpose={otpPurpose}
        channel={otpChannel}
        expiresIn={otpExpiresIn}
        devCode={otpDevCode}
        onBack={() =>
          setScreen(otpPurpose === "login" ? "signIn" : "phoneRegister")
        }
        onResent={(data) => {
          setOtpExpiresIn(data.expiresIn || 600);
          if (data.devCode) setOtpDevCode(data.devCode);
        }}
        onRequestResend={otpChannel === "email" ? () => sendGoogleEmailLoginOtp(googleOtpToken) : undefined}
        onVerify={async (code) => {
          if (otpPurpose === "register") {
            const { data } = await verifyOtpRegister({
              phone: otpPhone,
              code,
              firstName: signupData?.firstName,
              lastName: signupData?.lastName,
              name: signupData?.name,
              role: signupData?.role || pendingRole,
              email: signupData?.email,
              dateOfBirth: signupData?.dateOfBirth,
            });
            await afterAuth(data);
            return;
          }
          const { data } = otpChannel === "email"
            ? await verifyEmailLoginOtp(otpEmail, code)
            : await verifyOtpLogin(otpPhone, code);
          if (data.requireRoleSelection) {
            setPendingUsers([data.user, data.token]);
            setScreen("rolePicker");
            return;
          }
          const role = await applySession(data);
          await finishLogin(data, role);
        }}
      />
    );
  }

  if (screen === "rolePicker") {
    const dualUser = pendingUsers?.[0];
    return (
      <RolePickerScreen
        user={dualUser}
        onSelect={async (role) => {
          try {
            const loginToken = pendingUsers?.[1] || "";
            if (loginToken) setApiAuthToken(loginToken);
            const { data } = await selectRole(role, dualUser?.id || dualUser?._id);
            setPendingUsers(null);
            await applySession(data);
            // Override userRole with the selected role — DB role stays "customer"
            // for single-account dual-role, but UI must reflect the chosen view.
            setUserRole(role);
            setAuthTokenForSync(data.token || "");
            await finishLogin(data, role);
            return;
          } catch (e) {
            Alert.alert("Error", getErrorMessage(e));
          }
        }}
      />
    );
  }

  if (screen === "locationPermission") {
    return (
      <LocationPermissionScreen
        userRole={userRole}
        onAllow={() => setScreen("setLocation")}
        onManual={() => setScreen("setLocation")}
      />
    );
  }

  if (screen === "setLocation") {
    return (
      <SetLocationScreen
        authToken={authToken}
        onBack={() => setScreen("locationPermission")}
        onConfirm={() => goHome()}
      />
    );
  }

  if (screen === "home") {
    if (userRole === "fundi") {
      return tabLayout(
        bookingWrap(<FundiDashboardScreen userName={userName} {...tabProps} />),
        "home",
      );
    }
    return tabLayout(
      bookingWrap(<HomeScreen userName={userName} {...tabProps} />),
      "home",
    );
  }

  if (screen === "fundiDashboard") {
    return tabLayout(
      bookingWrap(<FundiDashboardScreen userName={userName} {...tabProps} />),
      "home",
    );
  }

  if (screen === "browse") {
    return tabLayout(bookingWrap(<BrowseArtisansScreen {...tabProps} />), "browse");
  }

  if (screen === "bookings") {
    return tabLayout(
      bookingWrap(
        <BookingsScreen
          {...tabProps}
          onViewHistory={() => pushAndNavigate("bookingHistory")}
        />
      ),
      "bookings",
    );
  }

  if (screen === "profile") {
    return tabLayout(<ProfileScreen {...tabPropsWithLogout} />, "profile");
  }

  if (screen === "chat") {
    return tabLayout(
      <ChatProvider userId={userId} authToken={authToken}>
        <ChatScreen onNavigate={handleNavigate} userRole={userRole} userId={userId} targetUserId={chatTargetUserId} inTab />
      </ChatProvider>,
      "chat",
    );
  }

  if (screen === "notifications") {
    return <NotificationsScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "editProfile") {
    return <EditProfileScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "skillsPortfolio") {
    return <SkillsPortfolioScreen onNavigate={handleNavigate} />;
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        onNavigate={handleNavigate}
        userRole={userRole}
      />
    );
  }

  if (screen === "payments") {
    return <PaymentMethodsScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "help") {
    return <HelpSupportScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "verification") {
    return (
      <VerificationScreen
        onNavigate={handleNavigate}
        onBack={
          verificationFromSetup
            ? () => {
                setVerificationFromSetup(false);
                setScreen("fundiProfileSetup");
              }
            : undefined
        }
      />
    );
  }

  if (screen === "wallet") {
    return tabLayout(<WalletHomeScreen onNavigate={handleNavigate} userRole={userRole} />, "wallet");
  }

  if (screen === "deposit") {
    return <DepositScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "withdraw") {
    return <WithdrawScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "transactionHistory") {
    return <TransactionHistoryScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "transfer") {
    return <TransferScreen onNavigate={handleNavigate} userRole={userRole} />;
  }

  if (screen === "artisan") {
    return (
      <ArtisanProfileScreen
        artisan={selectedArtisan || {}}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen === "request") {
    return bookingWrap(
      <RequestServiceScreen
        artisan={selectedArtisan || {}}
        authToken={authToken}
        onNavigate={handleNavigate}
        onSessionRestored={(session) => applySession(session)}
      />
    );
  }

  if (screen === "bookingWaiting") {
    return bookingWrap(
      <BookingWaitingScreen
        booking={clientBookingDraft || pendingBooking}
        onNavigate={handleNavigate}
        onBack={() => setScreen("home")}
        onComplete={handleJobComplete}
      />
    );
  }

  if (screen === "fundiBookingDetail") {
    return bookingWrap(
      <FundiBookingDetailScreen
        bookingId={selectedBookingId}
        onBack={() => setScreen("fundiDashboard")}
      />
    );
  }

  if (screen === "fundiNavigation") {
    return (
      <FundiNavigationScreen
        route={{ params: { bookingId: selectedBookingId } }}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen === "payment") {
    const booking =
      pendingBooking?.priceAgreed || pendingBooking?.agreedPrice
        ? pendingBooking
        : buildBookingFromRequest(
            pendingBooking,
            selectedArtisan || pendingBooking?.artisan || {},
          );
    return bookingWrap(
      <PaymentScreen
        booking={booking}
        onBack={() => setScreen("bookingWaiting")}
        onNavigate={handleNavigate}
        onPay={() => {
          const paidBooking = { ...booking, paid: true };
          setPendingBooking(paidBooking);
          setActiveJob(
            defaultActiveJob(paidBooking, selectedArtisan || paidBooking.artisan || {}),
          );
          setScreen("confirm");
        }}
      />
    );
  }

  if (screen === "confirm") {
    const booking =
      pendingBooking?.paid || pendingBooking?.priceAgreed
        ? pendingBooking
        : buildBookingFromRequest(
            pendingBooking,
            selectedArtisan || pendingBooking?.artisan || {},
          );
    return bookingWrap(
      <BookingConfirmationScreen
        booking={booking}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen === "tracking") {
    const job = activeJob || defaultActiveJob(pendingBooking, selectedArtisan);
    return bookingWrap(
      <LiveTrackingScreen
        job={job}
        onBack={() => setScreen("confirm")}
        onChat={() => handleNavigate("chat", { targetUserId: job?.fundiId })}
        onJobStarted={() => {
          setActiveJob({
            ...job,
            status: "in_progress",
            startedAt: Date.now(),
          });
          pushAndNavigate("jobInProgress");
        }}
      />
    );
  }

  if (screen === "jobInProgress") {
    const job = activeJob || defaultActiveJob(pendingBooking, selectedArtisan);
    return bookingWrap(
      <JobInProgressScreen
        job={job}
        onNavigate={handleNavigate}
        onComplete={handleJobComplete}
      />
    );
  }

  if (screen === "rateExperience") {
    const job = activeJob || defaultActiveJob(pendingBooking, selectedArtisan);
    return (
      <RateExperienceScreen
        job={job}
        existingReview={editingReview}
        reviewHistory={reviewHistory}
        onBack={() => {
          const wasEditing = Boolean(editingReview);
          setEditingReview(null);
          setScreen(wasEditing ? "bookingHistory" : "jobInProgress");
        }}
        onSubmit={handleReviewSubmit}
        onSetEditingReview={setEditingReview}
        authToken={authToken}
      />
    );
  }

  if (screen === "bookingHistory") {
    return (
      <BookingHistoryScreen
        bookings={reviewHistory}
        successMessage={reviewSuccessMessage}
        onBack={() => {
          setReviewSuccessMessage("");
          goHome();
        }}
        onEditReview={(item) => {
          setEditingReview(item);
          setActiveJob(
            item.job || {
              fundiName: item.fundiName,
              service: item.service,
              amount: item.amount,
              fundiId: item.fundiId,
              releasedAt: Date.now(),
            },
          );
          setReviewSuccessMessage("");
          pushAndNavigate("rateExperience");
        }}
      />
    );
  }

  return null;
  };

  return (
    <NotificationProvider userId={userId} authToken={authToken}>
      {renderScreen()}
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <LocationProvider>
          <View style={{ flex: 1, backgroundColor: theme.colors.black }}>
            <StatusBar
              barStyle="light-content"
              backgroundColor={theme.colors.black}
            />
            <AppContent />
          </View>
        </LocationProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
