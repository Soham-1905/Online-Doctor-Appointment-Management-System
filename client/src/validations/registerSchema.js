import * as Yup from "yup";

export const registerSchema = Yup.object().shape({
  name: Yup.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters").required("Name is required"),
  email: Yup.string().trim().email("Invalid email").max(254, "Email is too long").required("Email is required"),
  password: Yup.string().min(6, "Password must be at least 6 characters").max(128, "Password must be at most 128 characters").required("Password is required"),
});
