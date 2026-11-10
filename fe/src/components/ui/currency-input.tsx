import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatIndianNumber,
  sanitizeIndianInput,
} from "@/lib/indianNumber";

export type CurrencyInputProps = Omit<
  InputProps,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  value?: number | string | null;
  onChange?: (value: number) => void;
  /** Allow decimal places (default true) */
  allowDecimals?: boolean;
  maxDecimals?: number;
  /** Show empty string instead of 0 when value is 0 (default false for forms) */
  emptyWhenZero?: boolean;
};

/**
 * Text input that formats numbers with Indian grouping while typing
 * (e.g. 100000 → 1,00,000). Emits a numeric value via onChange.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      allowDecimals = true,
      maxDecimals = 2,
      emptyWhenZero = false,
      className,
      ...props
    },
    ref
  ) => {
    const [display, setDisplay] = React.useState(() =>
      formatIndianNumber(value, { allowDecimals, maxDecimals, emptyWhenZero })
    );
    const [focused, setFocused] = React.useState(false);

    React.useEffect(() => {
      if (focused) return;
      setDisplay(
        formatIndianNumber(value, { allowDecimals, maxDecimals, emptyWhenZero })
      );
    }, [value, allowDecimals, maxDecimals, emptyWhenZero, focused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value: nextValue, display: nextDisplay } = sanitizeIndianInput(
        e.target.value,
        { allowDecimals, maxDecimals }
      );
      setDisplay(nextDisplay);
      onChange?.(nextValue);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      setDisplay(
        formatIndianNumber(value, { allowDecimals, maxDecimals, emptyWhenZero })
      );
      onBlur?.(e);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={allowDecimals ? "decimal" : "numeric"}
        className={cn("text-right tabular-nums", className)}
        value={display}
        onChange={handleChange}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={handleBlur}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
