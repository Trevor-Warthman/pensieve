import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

// No ISR/image-optimization/warmer — app has no next/image usage and no
// revalidation, so keep this to the plain server function only.
const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: "aws-lambda", // buffered response, matches Function URL RESPONSE_TYPE=BUFFERED
      // Invoked as a plain Lambda Function URL (CloudFront is just an HTTP
      // client to it, not Lambda@Edge/CloudFront Functions), so the event
      // payload is API Gateway v2 format, not the CloudFront/Lambda@Edge
      // envelope — "aws-cloudfront" converter expects Records[0].cf.request
      // and throws on this event shape.
      converter: "aws-apigw-v2",
    },
  },
  middleware: {
    external: false, // bundle into the server function, not Lambda@Edge
  },
};

export default config;
