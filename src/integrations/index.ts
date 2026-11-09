import { labAccountService } from "./account/lab";
import { labCartService } from "./cart/lab";
import { labProductService } from "./product/lab";
import { labSmsService } from "./sms/lab";

/** Swap these implementations when wiring the main Sainagold site. */
export const accountService = labAccountService;
export const productService = labProductService;
export const cartService = labCartService;
export const smsService = labSmsService;
