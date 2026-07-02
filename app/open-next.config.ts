import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

// No ISR/image-optimization/warmer — app has no next/image usage and no
// revalidation, so keep this to the plain server function only.
const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "aws-lambda", // buffered response, matches Function URL RESPONSE_TYPE=BUFFERED
      converter: "aws-cloudfront",
    },
  },
  middleware: {
    external: false, // bundle into the server function, not Lambda@Edge
  },
};

export default config;
