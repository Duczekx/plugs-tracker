self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }
  const payload = event.data.json();
  const title = payload.title || "Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || "plugs-tracker",
    data: payload.url || "/",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const hasMatch = clientsArr.some((client) => {
        if (client.url.includes(target)) {
          client.focus();
          return true;
        }
        return false;
      });
      if (!hasMatch) {
        return self.clients.openWindow(target);
      }
      return undefined;
    })
  );
});
