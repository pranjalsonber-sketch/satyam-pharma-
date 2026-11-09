export function getDeviceInfo(): string {
  if (typeof window === 'undefined') return 'Server';
  
  const ua = window.navigator.userAgent;
  let browser = 'Browser';
  let os = 'Unknown OS';

  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('SamsungBrowser') > -1) browser = 'Samsung Internet';
  else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera';
  else if (ua.indexOf('Trident') > -1) browser = 'Internet Explorer';
  else if (ua.indexOf('Edge') > -1 || ua.indexOf('Edg') > -1) browser = 'Microsoft Edge';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';

  if (ua.indexOf('Win') !== -1) os = 'Windows';
  else if (ua.indexOf('Mac') !== -1) os = 'macOS';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux';
  else if (ua.indexOf('Android') !== -1) os = 'Android';
  else if (ua.indexOf('like Mac') !== -1 || ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const platform = isMobile ? 'Mobile' : 'Desktop';

  return `${browser} on ${os} (${platform})`;
}

export function getTerminalName(): string {
  if (typeof window === 'undefined') return 'Terminal 1';
  let stored = localStorage.getItem('satyam_terminal_id');
  if (!stored) {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    stored = isMobile ? 'Mobile POS Terminal' : `POS Counter-${Math.floor(1 + Math.random() * 3)}`;
    localStorage.setItem('satyam_terminal_id', stored);
  }
  return stored;
}
