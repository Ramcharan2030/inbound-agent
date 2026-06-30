# Cost Estimation Plan

This document summarizes the current deployment budget and the call-by-minute cost model used by the backend.

## Deployment plan

The repository documentation recommends a two-part deployment:

- Frontend on Vercel: free tier, approximately $0 / ₹0 per month for standard usage.
- Backend on a small VPS such as DigitalOcean or Hetzner: around $6 / month, or roughly ₹500 to ₹600 depending on exchange rate.

Recommended monthly infrastructure budget:

- Frontend: ₹0
- Backend VPS: ₹500 to ₹600
- Total deployment budget: about ₹500 to ₹600 per month

## Call cost model

The backend currently stores a per-call estimate in [agent_backend.py](agent_backend.py) using these values:

- Vobiz cost: ₹0.40 per minute
- LiveKit cost: ₹0.00 per minute
- Gemini cost: ₹0.85 per minute
- Total direct call cost: ₹1.25 per minute

Formula used by the backend:

```text
duration_minutes = duration_seconds / 60
total_inr = duration_minutes * 0.40 + duration_minutes * 0.00 + duration_minutes * 0.85
```

The stored estimate in the code also includes a separate usage-based estimate:

```text
estimated_cost_usd = (duration_seconds / 60) * 0.008 + (transcript_chars / 1000) * 0.003
```

## Example call costs

| Call length | Vobiz | LiveKit | Gemini | Total |
| --- | ---: | ---: | ---: | ---: |
| 1 minute | ₹0.40 | ₹0.00 | ₹0.85 | ₹1.25 |
| 5 minutes | ₹2.00 | ₹0.00 | ₹4.25 | ₹6.25 |
| 10 minutes | ₹4.00 | ₹0.00 | ₹8.50 | ₹12.50 |
| 30 minutes | ₹12.00 | ₹0.00 | ₹25.50 | ₹37.50 |

## Monthly scenarios

These examples use the current backend rate of ₹1.25 per call minute.

| Monthly call volume | Call cost | Deployment cost | Total |
| --- | ---: | ---: | ---: |
| 100 minutes | ₹125 | ₹500 to ₹600 | ₹625 to ₹725 |
| 500 minutes | ₹625 | ₹500 to ₹600 | ₹1,125 to ₹1,225 |
| 1,000 minutes | ₹1,250 | ₹500 to ₹600 | ₹1,750 to ₹1,850 |
| 2,000 minutes | ₹2,500 | ₹500 to ₹600 | ₹3,000 to ₹3,100 |

## Notes

- The deployment numbers come from [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) and the backend runtime layout in [README.md](README.md).
- The per-minute call cost comes from the live calculation in [agent_backend.py](agent_backend.py).
- If your upstream vendors change their pricing, update the constants in [agent_backend.py](agent_backend.py) and this document together.

## Recommended pricing policy

If you want to charge end users, a safe starting margin is:

- Minimum retail price: ₹2.00 per minute
- Suggested retail price: ₹2.50 to ₹3.00 per minute

This leaves room for infrastructure, vendor changes, and support overhead.
