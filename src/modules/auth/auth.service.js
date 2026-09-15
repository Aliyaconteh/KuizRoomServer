const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { supabase, supabaseAdmin } = require("../../config/supabase.config");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

class AuthService {

  //  SIGN UP - HOST ONLY
  async signup(email, password, username) {
    // Validate input
    if (!email || !password || !username) {
      throw new Error("Email, password, and username are required");
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert([
        {
          email,
          username: username.trim(),
          password_hash: hashedPassword,
          role: "host" // Host-specific role
        }
      ])
      .select()
      .single();

    if (error) throw new Error(`Signup failed: ${error.message}`);

    // Generate JWT token
    const token = this.generateToken(data.id, data.email);

    return {
      user: {
        id: data.id,
        email: data.email,
        username: data.username,
        role: data.role
      },
      token,
      message: "Signup successful"
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
      .eq("email", email)
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

    if (user && user.username !== googleUsername) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({ username: googleUsername })
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
            role: "host"
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
