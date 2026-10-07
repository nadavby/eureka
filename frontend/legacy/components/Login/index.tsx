import { FC, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import userService from "../../services/user-service";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faLock, faSignInAlt } from "@fortawesome/free-solid-svg-icons";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";

type FormData = {
  email: string;
  password: string;
};

export const Login: FC = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();
  const [serverError, setServerError] = useState("");

  const onSubmit = async (data: FormData) => {
    try {
      const response = await userService.login(data.email, data.password);

      if (response && response.accessToken && response.refreshToken) {
        window.location.href = "/lost-items";
      }
    } catch (error) {
      setServerError("Incorrect email or password.");
      console.error(error);
    }
  };
  
  const onGoogleLoginSuccess = async (response: CredentialResponse) => {
    try {
      const googleRes = await userService.googleSignIn(response);
      
      if (googleRes && googleRes.accessToken && googleRes.refreshToken) {
        window.location.href = "/lost-items";
      }
    } catch (error) {
      console.error(error);
      setServerError("Google login failed. Please try again.");
    }
  };

  const onGoogleLoginError = () => {
    setServerError("Google login failed. Please try again.");
  };

  return (
    <div className="container mt-3">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="text-center mb-4">
                  <img
                    src="/eureka.jpg"
                    alt="Eureka Logo"
                    className="rounded"
                    style={{
                      width: "100px",
                      height: "100px",
                      objectFit: "cover",
                    }}
                  />
                </div>

                {serverError && (
                  <div className="alert alert-danger" role="alert">
                    {serverError}
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="email" className="form-label d-flex align-items-center">
                    <FontAwesomeIcon icon={faEnvelope} className="me-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    className={`form-control ${errors.email ? "is-invalid" : ""}`}
                    {...register("email")}
                    required
                    placeholder="Enter your email"
                  />
                  {errors.email && (
                    <div className="invalid-feedback">{errors.email.message}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label htmlFor="password" className="form-label d-flex align-items-center">
                    <FontAwesomeIcon icon={faLock} className="me-2" />
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    className={`form-control ${errors.password ? "is-invalid" : ""}`}
                    {...register("password")}
                    required
                    placeholder="Enter your password"
                  />
                  {errors.password && (
                    <div className="invalid-feedback">{errors.password.message}</div>
                  )}
                </div>

                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary d-flex align-items-center justify-content-center gap-2"
                  >
                    <FontAwesomeIcon icon={faSignInAlt} />
                    Login
                  </button>
                  <div className="mt-3 text-center">
                    <p className="text-muted mb-2">Or Login with</p>
                    <div className="d-flex justify-content-center">
                      <GoogleLogin
                        onSuccess={onGoogleLoginSuccess}
                        onError={onGoogleLoginError}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <p className="mb-0">
                    Don't have an account?{" "}
                    <Link to="/register" className="text-primary">
                      Register here
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};