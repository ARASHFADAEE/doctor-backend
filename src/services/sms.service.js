const soap = require('soap');

const PAYAMAK_WSDL = process.env.PAYAMAK_WSDL || 'http://api.payamak-panel.com/post/send.asmx?wsdl';
const PAYAMAK_USERNAME = process.env.PAYAMAK_USERNAME;
const PAYAMAK_PASSWORD = process.env.PAYAMAK_PASSWORD;
const PAYAMAK_OTP_BODY_ID = process.env.PAYAMAK_OTP_BODY_ID; // بدنه پترن OTP در پنل ملی پیامک

let soapClientPromise = null;
function getSoapClient() {
  if (!soapClientPromise) {
    soapClientPromise = new Promise((resolve, reject) => {
      soap.createClient(PAYAMAK_WSDL, { wsdl_options: { timeout: 5000 }, endpoint: PAYAMAK_WSDL }, (err, client) => {
        if (err) return reject(err);
        // تنظیم کدینگ برای اطمینان از UTF-8 مانند نمونه PHP
        try { client.setEndpoint(PAYAMAK_WSDL); } catch (_) {}
        resolve(client);
      });
    });
  }
  return soapClientPromise;
}

async function sendByBaseNumber3({ username, password, text, to }) {
  const client = await getSoapClient();
  return new Promise((resolve) => {
    client.SendByBaseNumber3({ username, password, text, to }, (err, result) => {
      if (err) return resolve({ success: false, error: err.message });
      const resVal = result?.SendByBaseNumber3Result ?? '';
      // موفقیت: مقدار عددی مثبت (طبق مستندات recId عدد بزرگ)
      const isNumeric = /^\d+$/.test(resVal);
      const numericVal = isNumeric ? parseInt(resVal, 10) : NaN;
      if (isNumeric && numericVal > 0) {
        resolve({ success: true, recId: resVal });
      } else {
        resolve({ success: false, code: resVal });
      }
    });
  });
}

function buildPatternText(bodyId, args = []) {
  const vars = Array.isArray(args) ? args.join(';') : String(args);
  return `@${bodyId}@${vars}`;
}

async function sendPatternSMS(bodyId, args, to) {
  if (!PAYAMAK_USERNAME || !PAYAMAK_PASSWORD) {
    console.log(`[SMS MOCK][Payamak] text=${buildPatternText(bodyId, args)} to=${to}`);
    return { success: true, mocked: true };
  }
  const text = buildPatternText(bodyId, args);
  return await sendByBaseNumber3({ username: PAYAMAK_USERNAME, password: PAYAMAK_PASSWORD, text, to });
}

async function sendOTP(phone, code) {
  const bodyId = PAYAMAK_OTP_BODY_ID;
  if (!bodyId) {
    console.warn('PAYAMAK_OTP_BODY_ID is not set; using mock send.');
    console.log(`[SMS MOCK][OTP] code=${code} to=${phone}`);
    return { success: true, mocked: true };
  }
  return await sendPatternSMS(bodyId, [code], phone);
}

module.exports = {
  sendOTP,
  sendPatternSMS,
};
