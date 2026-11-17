# Email configuration

Clerk owns authentication email through the Clerk Dashboard. Order notifications
are sent through OpenMail's REST API. Set `OPENMAIL_API_KEY` to a server-only
OpenMail API key, `OPENMAIL_INBOX_ID` to the sender inbox ID, and
`OPENMAIL_ADDRESS` to its address in your local and deployment environments.
Use an inbox-scoped key where possible; never expose it with `NEXT_PUBLIC_` or
commit it. The sender is the inbox identified by `OPENMAIL_INBOX_ID`.

New-order alerts are addressed to `OWNER_EMAIL` and `ADMIN_EMAIL`. Customers
receive confirmations at their checkout email and updates for tying and out
for delivery. Older orders use the linked account email if available. Email
failures are logged without message contents, do not undo an order or status
change, and are not retried automatically.

OpenMail applies limits to messages sent to new recipients. Shared OpenMail
domains may add unsubscribe headers and suppress later messages after an
unsubscribe, including transactional messages. Check OpenMail's current limits,
delivery status and policies before relying on it for order confirmations; a
verified custom sending domain provides more control. A successful send API
response does not guarantee delivery to the recipient's inbox.
