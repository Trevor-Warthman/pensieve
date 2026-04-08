import boto3
import os
from datetime import datetime, timedelta


def handler(event, context):
    today = datetime.today()
    first_of_this_month = today.replace(day=1)
    last_month_end = first_of_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    start = last_month_start.strftime("%Y-%m-%d")
    end = first_of_this_month.strftime("%Y-%m-%d")
    month_name = last_month_start.strftime("%B %Y")

    ce = boto3.client("ce", region_name="us-east-1")
    response = ce.get_cost_and_usage(
        TimePeriod={"Start": start, "End": end},
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    results = response["ResultsByTime"][0]
    groups = sorted(
        results["Groups"],
        key=lambda g: float(g["Metrics"]["UnblendedCost"]["Amount"]),
        reverse=True,
    )

    total = sum(float(g["Metrics"]["UnblendedCost"]["Amount"]) for g in groups)

    lines = [f"Pensieve AWS Cost Report — {month_name}", "=" * 44]
    for g in groups:
        amount = float(g["Metrics"]["UnblendedCost"]["Amount"])
        if amount >= 0.0001:
            lines.append(f"  {g['Keys'][0]:<38} ${amount:.4f}")
    lines.append("-" * 44)
    lines.append(f"  {'Total':<38} ${total:.4f}")
    if total < 0.01:
        lines.append("\nAll usage within free tier. No charges this month.")

    body = "\n".join(lines)
    email = os.environ["REPORT_EMAIL"]

    ses = boto3.client("ses", region_name="us-east-1")
    ses.send_email(
        Source=email,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": f"Pensieve AWS Cost Report — {month_name}"},
            "Body": {"Text": {"Data": body}},
        },
    )

    return {"statusCode": 200, "body": body}
