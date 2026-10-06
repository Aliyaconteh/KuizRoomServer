const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { supabase, supabaseAdmin } = require("../../config/supabase.config");
const { sendVerificationEmail } = require("../../utils/email");

const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === "production" ? null : "your-secret-key-change-in-production");
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

class AuthService {

  //  SIGN UP - HOST ONLY
  async signup(email, password, username) {
    // Validate input
    if (!email || !password || !username) {
      throw new Error("Email, password, and username are required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data: existingUser, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw new Error(`Signup failed: ${lookupError.message}`);
    if (existingUser) {
      throw new Error("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashVerificationToken(verificationToken);
    const tokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString();

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert([
        {
          email: normalizedEmail,
          username: username.trim(),
          password_hash: hashedPassword,
          role: "host",
          email_verified: false,
          email_verification_token_hash: tokenHash,
          email_verification_expires_at: tokenExpiresAt
        }
      ])
      .select()
      .single();

    if (error) throw new Error(`Signup failed: ${error.message}`);

    try {
      await sendVerificationEmail(data.email, verificationToken);
    } catch (err) {
      const { error: deleteError } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", data.id);
      if (deleteError) {
        console.error("[AUTH_SIGNUP] Failed to remove account after email delivery failure:", deleteError);
      }
      throw err;
    }

    return {
      email: data.email,
      message: "Account created. Check your email for a verification link."
    };
  }

  //  LOGIN - HOST ONLY
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Get user from database
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (error) {
      // PGRST116 means zero rows found (not a database failure, but invalid user)
      if (error.code === "PGRST116") {
        throw new Error("Invalid email or password");
      }
      console.error("[AUTH_SERVICE] Database lookup error:", error);
      throw new Error(`Database error during authentication: ${error.message}`);
    }

    if (!user || !user.password_hash) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    if (!user.email_verified) {
      const error = new Error("Please verify your email before signing in");
      error.code = "EMAIL_NOT_VERIFIED";
      throw error;
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || "host"
      },
      token,
      message: "Login successful"
    };
  }

  async loginWithGoogle(accessToken) {
    if (!accessToken) {
      throw new Error("Google access token is required");
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const googleUser = authData?.user;

    if (authError || !googleUser?.email) {
      throw new Error("Invalid Google sign-in");
    }

    const email = googleUser.email.toLowerCase();
    const googleUsername = this.getOAuthUsername(googleUser);
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, username, role")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      throw new Error(`Google sign-in failed: ${userError.message}`);
    }

    let user = existingUser;

    if (user) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          username: googleUsername,
          email_verified: true,
          email_verification_token_hash: null,
          email_verification_expires_at: null
        })
        .eq("id", user.id)
        .select("id, email, username, role")
        .single();

      if (updateError) {
        throw new Error(`Google sign-in failed: ${updateError.message}`);
      }

      user = updatedUser;
    }

    if (!user) {
      const { data: createdUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert([
          {
            id: googleUser.id,
            email,
            username: googleUsername,
            role: "host",
            email_verified: true
          }
        ])
        .select("id, email, username, role")
        .single();

      if (createError) {
        throw new Error(`Google sign-in failed: ${createError.message}`);
      }

      user = createdUser;
    }

    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || "host"
      },
      token,
      message: "Google sign-in successful"
    };
  }

  async verifyEmail(token) {
    if (!token || typeof token !== "string") {
      throw new Error("Verification link is invalid or expired");
    }

    const now = new Date().toISOString();
    const { data: user, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email_verification_token_hash", this.hashVerificationToken(token))
      .gt("email_verification_expires_at", now)
      .eq("email_verified", false)
      .maybeSingle();

    if (lookupError) throw new Error(`Email verification failed: ${lookupError.message}`);
    if (!user) throw new Error("Verification link is invalid or expired");

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        email_verified: true,
        email_verification_token_hash: null,
        email_verification_expires_at: null
      })
      .eq("id", user.id)
      .eq("email_verified", false)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(`Email verification failed: ${updateError.message}`);
    if (!updatedUser) throw new Error("Verification link is invalid or expired");

    return { message: "Email verified. You can now sign in." };
  }

  async resendVerificationEmail(email) {
    if (!email || typeof email !== "string") return;

    const normalizedEmail = email.trim().toLowerCase();
    const { data: user, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", normalizedEmail)
      .eq("email_verified", false)
      .maybeSingle();

    if (lookupError) throw new Error(`Unable to resend verification email: ${lookupError.message}`);
    if (!user) return;

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        email_verification_token_hash: this.hashVerificationToken(verificationToken),
        email_verification_expires_at: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString()
      })
      .eq("id", user.id);

    if (updateError) throw new Error(`Unable to resend verification email: ${updateError.message}`);
    await sendVerificationEmail(user.email, verificationToken);
  }

  hashVerificationToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async updateProfile(userId, username) {
    const trimmedUsername = username?.trim();

    if (!trimmedUsername) {
      throw new Error("Username is required");
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ username: trimmedUsername })
      .eq("id", userId)
      .select("id, email, username, role")
      .single();

    if (error || !data) {
      throw new Error("Failed to update profile");
    }

    return {
      user: data,
      message: "Profile updated successfully"
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error("Current and new password are required");
    }

    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters");
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("password_hash")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new Error("User not found");
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabaseAdmin
      .from("users")
      .update({ password_hash: hashedPassword })
      .eq("id", userId);

    if (error) {
      throw new Error("Failed to update password");
    }

    return {
      message: "Password updated successfully"
    };
  }

  //  GET USER FROM TOKEN
  async getUser(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const { data: user, error } = await supabaseAdmin
        .from("users")
        .select("id, email, username, role")
        .eq("id", decoded.userId)
        .single();

      if (error || !user) throw new Error("User not found");
      return user;
    } catch (err) {
      throw new Error("Invalid or expired token");
    }
  }

  //  VERIFY TOKEN (for middleware)
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new Error("Invalid or expired token");
    }
  }

  // LOGOUT (invalidate token - handled by client)
  logout() {
    // Token-based auth: client should discard token
    return { message: "Logout successful" };
  }

  // Helper: Generate JWT
  generateToken(userId, email) {
    return jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
  }

  // Helper: Ensure user profile
  async ensureUserProfile(user) {
    const username = this.getOAuthUsername(user);

    const { error } = await supabaseAdmin
      .from("users")
      .upsert({
        id: user.id,
        email: user.email,
        username,
        role: "host"
      }, { onConflict: "id" });

    if (error) throw error;
  }

  getOAuthUsername(user) {
    const metadata = user.user_metadata || {};
    const googleIdentity = user.identities?.find((identity) => identity.provider === "google");
    const identityData = googleIdentity?.identity_data || {};
    const googleName = metadata.full_name
      || metadata.name
      || metadata.display_name
      || identityData.full_name
      || identityData.name
      || identityData.display_name;

    return googleName?.trim()
      || user.email?.split("@")[0]
      || "Host";
  }
}

module.exports = new AuthService();
