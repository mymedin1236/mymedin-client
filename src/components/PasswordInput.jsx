import { useState } from "react";
import Icon from "./Icon";

// Password input with a show/hide eye toggle. Drop-in for a normal <input>.
export default function PasswordInput({
  name = "password",
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete = "off",
  invalid = false,
  leadingIcon,
  defaultVisible = false,
}) {
  const [show, setShow] = useState(defaultVisible);
  return (
    <div className={`password-field ${leadingIcon ? "has-leading" : ""}`}>
      {leadingIcon && <Icon name={leadingIcon} size={20} className="field-leading" />}
      <input
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={invalid ? "invalid" : ""}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <Icon name={show ? "visibility" : "visibility_off"} size={20} />
      </button>
    </div>
  );
}
