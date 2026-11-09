export interface DailyQuote {
  id: number;
  en: string;
  hi: string;
  authorEn: string;
  authorHi: string;
  category: 'precision' | 'service' | 'wisdom' | 'wellness' | 'empathy' | 'excellence' | 'healing';
  categoryLabelEn: string;
  categoryLabelHi: string;
  tipEn?: string;
  tipHi?: string;
}

export const DAILY_QUOTES: DailyQuote[] = [
  {
    id: 1,
    en: 'Precision in medicine is the highest form of service.',
    hi: 'औषधि और चिकित्सा में शुद्धता व सटीकता ही सच्ची सेवा है।',
    authorEn: 'Pharmacy Proverb',
    authorHi: 'फार्मेसी सूक्ति',
    category: 'precision',
    categoryLabelEn: 'Precision & Accuracy',
    categoryLabelHi: 'सटीकता और शुद्धता',
    tipEn: 'Always double-check dosage strengths and expiry dates before dispensing.',
    tipHi: 'दवा देने से पहले खुराक की ताकत और एक्सपायरी तिथि अवश्य जांचें।'
  },
  {
    id: 2,
    en: 'Wherever the art of medicine is loved, there is also a love of humanity.',
    hi: 'जहाँ चिकित्सा की कला से प्रेम होता है, वहाँ मानवता से भी गहरा प्रेम होता है।',
    authorEn: 'Hippocrates',
    authorHi: 'हिप्पोक्रेट्स',
    category: 'empathy',
    categoryLabelEn: 'Empathy & Care',
    categoryLabelHi: 'सहानुभूति व सेवाभाव',
    tipEn: 'A warm smile and patient listening alleviate half of a customer’s anxiety.',
    tipHi: 'मुस्कुराहट और धैर्यपूर्वक मरीज की बात सुनने से उनकी आधी चिंता दूर हो जाती है।'
  },
  {
    id: 3,
    en: 'The greatest wealth is health, and the pharmacist is its faithful guardian.',
    hi: 'स्वास्थ्य ही सबसे बड़ा धन है, और फार्मासिस्ट इसके निष्ठावान रक्षक हैं।',
    authorEn: 'Virgil & Pharmacy Lore',
    authorHi: 'वर्जिल व स्वास्थ्य परंपरा',
    category: 'wellness',
    categoryLabelEn: 'Health & Wellness',
    categoryLabelHi: 'स्वास्थ्य एवं कल्याण',
    tipEn: 'Remind patients to stay hydrated and complete full antibiotic courses.',
    tipHi: 'मरीजों को पर्याप्त पानी पीने और एंटीबायोटिक का पूरा कोर्स करने की सलाह दें।'
  },
  {
    id: 4,
    en: 'Care and compassion are the greatest medicines known to humankind.',
    hi: 'देखभाल और करुणा मानव जाति के लिए ज्ञात सबसे श्रेष्ठ औषधियां हैं।',
    authorEn: 'Dr. Albert Schweitzer',
    authorHi: 'डॉ. अल्बर्ट श्वाइट्ज़र',
    category: 'service',
    categoryLabelEn: 'Service & Dedication',
    categoryLabelHi: 'समर्पण एवं सेवा',
    tipEn: 'Explain medication timings clearly to elderly patients with empathy.',
    tipHi: 'बुजुर्ग मरीजों को दवा लेने का सही समय सहज और स्पष्ट रूप से समझाएं।'
  },
  {
    id: 5,
    en: 'Attention to detail in dosage is the bridge between a remedy and a poison.',
    hi: 'खुराक की सूक्ष्मता ही औषधि और विष के बीच का अंतर निर्धारित करती है।',
    authorEn: 'Paracelsus',
    authorHi: 'पैरासेल्सस',
    category: 'precision',
    categoryLabelEn: 'Drug Safety',
    categoryLabelHi: 'औषधि सुरक्षा',
    tipEn: 'Always verify pediatric syrup concentrations against the child’s age and weight.',
    tipHi: 'बच्चों के सिरप की मात्रा और सांद्रता की उम्र व वजन के अनुसार पुनर्जांच करें।'
  },
  {
    id: 6,
    en: 'To cure sometimes, to relieve often, to comfort always.',
    hi: 'कभी-कभी रोगमुक्त करना, अक्सर राहत पहुंचाना, और सदैव संबल देना ही हमारा कर्तव्य है।',
    authorEn: 'Edward Trudeau',
    authorHi: 'एडवर्ड ट्रूडो',
    category: 'healing',
    categoryLabelEn: 'Healing & Comfort',
    categoryLabelHi: 'राहत और सांत्वना',
    tipEn: 'Take a 30-second deep breath between busy customer rushes to stay centered.',
    tipHi: 'भीड़ के समय बीच-बीच में 30 सेकंड का गहरा सांस लेकर मानसिक शांति बनाए रखें।'
  },
  {
    id: 7,
    en: 'A good pharmacist dispenses not just medicines, but hope, guidance, and peace of mind.',
    hi: 'एक अच्छा फार्मासिस्ट केवल दवाइयां नहीं, बल्कि आशा, सही मार्गदर्शन और मानसिक शांति भी देता है।',
    authorEn: 'Clinical Wisdom',
    authorHi: 'चिकित्सीय सूक्ति',
    category: 'service',
    categoryLabelEn: 'Professional Guidance',
    categoryLabelHi: 'पेशेवर मार्गदर्शन',
    tipEn: 'Provide clear instructions on taking medicines before or after meals.',
    tipHi: 'दवा भोजन से पहले लेनी है या बाद में, यह मरीज को स्पष्ट रूप से बताएं।'
  },
  {
    id: 8,
    en: 'The body heals with play, the mind heals with laughter, and the spirit heals with joy.',
    hi: 'शरीर खेल से, मन हंसी से और आत्मा आनंद से स्वस्थ होती है।',
    authorEn: 'Proverb',
    authorHi: 'प्राचीन कहावत',
    category: 'wellness',
    categoryLabelEn: 'Mind & Body Balance',
    categoryLabelHi: 'मन व शरीर संतुलन',
    tipEn: 'Stretch your spine and shoulders regularly during long dispensary shifts.',
    tipHi: 'काउंटर पर खड़े रहने के दौरान अपनी पीठ और कंधों को समय-समय पर स्ट्रेच करें।'
  },
  {
    id: 9,
    en: 'Excellence is not an act, but a habit of continuous dedication and care.',
    hi: 'उत्कृष्टता कोई आकस्मिक कार्य नहीं, बल्कि निरंतर समर्पण और अभ्यास की आदत है।',
    authorEn: 'Aristotle',
    authorHi: 'अरस्तू',
    category: 'excellence',
    categoryLabelEn: 'Excellence & Quality',
    categoryLabelHi: 'उत्कृष्टता एवं गुणवत्ता',
    tipEn: 'Maintain organized shelves to ensure lightning-fast and error-free dispensing.',
    tipHi: 'शेल्व्स को व्यवस्थित रखें ताकि दवा ढूंढने में समय न लगे और त्रुटि से बचा जा सके।'
  },
  {
    id: 10,
    en: 'Let food be thy medicine and medicine be thy food.',
    hi: 'आहार को अपनी औषधि बनाएं और औषधि को आहार का पूरक।',
    authorEn: 'Charaka Samhita & Hippocrates',
    authorHi: 'चरक संहिता व हिप्पोक्रेट्स',
    category: 'wellness',
    categoryLabelEn: 'Holistic Health',
    categoryLabelHi: 'समग्र स्वास्थ्य',
    tipEn: 'Counsel diabetic patients on balanced diet alongside glycemic medications.',
    tipHi: 'मधुमेह के मरीजों को दवा के साथ-साथ संतुलित आहार व परहेज के महत्व को बताएं।'
  },
  {
    id: 11,
    en: 'In the middle of every difficulty lies the opportunity to serve with honor.',
    hi: 'प्रत्येक कठिनाई के बीच में निष्ठापूर्वक सेवा करने का स्वर्णिम अवसर छुपा होता है।',
    authorEn: 'Albert Einstein',
    authorHi: 'अल्बर्ट आइंस्टीन',
    category: 'wisdom',
    categoryLabelEn: 'Resilience & Service',
    categoryLabelHi: 'धैर्य एवं सेवाभाव',
    tipEn: 'Handle anxious customer inquiries with calm patience and reassurance.',
    tipHi: 'चिंतित ग्राहकों के प्रश्नों का उत्तर शांत और आश्वस्त करने वाले स्वर में दें।'
  },
  {
    id: 12,
    en: 'Knowledge without empathy is cold; empathy without knowledge is ineffective.',
    hi: 'सहानुभूति के बिना ज्ञान अधूरा है, और ज्ञान के बिना सहानुभूति अप्रभावी है।',
    authorEn: 'Medical Ethics Principle',
    authorHi: 'चिकित्सा नीति सिद्धांत',
    category: 'wisdom',
    categoryLabelEn: 'Ethics & Wisdom',
    categoryLabelHi: 'नैतिकता एवं विवेक',
    tipEn: 'Stay updated with new salt combinations and potential drug-drug interactions.',
    tipHi: 'नए साल्ट कॉम्बिनेशन और ड्रग इंटरैक्शन की जानकारी से स्वयं को अपडेट रखें।'
  },
  {
    id: 13,
    en: 'Patience and thoroughness today prevent mistakes tomorrow.',
    hi: 'आज का धैर्य और सतर्कता आने वाले कल की भूलों से बचाती है।',
    authorEn: 'Quality Assurance Proverb',
    authorHi: 'गुणवत्ता सूक्ति',
    category: 'precision',
    categoryLabelEn: 'Verification & Safety',
    categoryLabelHi: 'सत्यापन और सतर्कता',
    tipEn: 'Read the doctor’s prescription twice, especially for look-alike sound-alike (LASA) drugs.',
    tipHi: 'समान नाम वाली दवाइयों (LASA) के लिए पर्चे को दो बार ध्यानपूर्वक पढ़ें।'
  },
  {
    id: 14,
    en: 'The purpose of human life is to serve, and to show compassion and the will to help others.',
    hi: 'मानव जीवन का सच्चा उद्देश्य दूसरों की सेवा करना और सहायता का भाव रखना है।',
    authorEn: 'Albert Schweitzer',
    authorHi: 'अल्बर्ट श्वाइट्ज़र',
    category: 'service',
    categoryLabelEn: 'Compassion',
    categoryLabelHi: 'करुणा एवं दया',
    tipEn: 'Help patients understand proper storage for insulins and refrigerated items.',
    tipHi: 'इंसुलिन और कोल्ड-चेन वाली दवाओं के सही भंडारण (फ्रिज) का तरीका समझाएं।'
  },
  {
    id: 15,
    en: 'Your calm mind is the ultimate weapon against your challenges. So relax.',
    hi: 'आपका शांत मन ही सभी चुनौतियों का सबसे बड़ा समाधान है। अतः शांत रहें।',
    authorEn: 'Bryant McGill',
    authorHi: 'ब्रायंट मैकगिल',
    category: 'wellness',
    categoryLabelEn: 'Mental Peace',
    categoryLabelHi: 'मानसिक शांति',
    tipEn: 'Practice the 20-20-20 screen rule to rest your eyes during billing hours.',
    tipHi: 'बिलिंग के दौरान हर 20 मिनट बाद 20 सेकंड के लिए 20 फीट दूर देखकर आंखों को आराम दें।'
  },
  {
    id: 16,
    en: 'Behind every prescription is a human story waiting for healing and comfort.',
    hi: 'हर पर्चे के पीछे एक इंसान और उसके स्वास्थ्य लाभ की आशा जुड़ी होती है।',
    authorEn: 'Healthcare Philosophy',
    authorHi: 'स्वास्थ्य दर्शन',
    category: 'empathy',
    categoryLabelEn: 'Human Touch',
    categoryLabelHi: 'मानवीय संवेदना',
    tipEn: 'Greet regular monthly refill customers by their name to build lifelong trust.',
    tipHi: 'मासिक नियमित ग्राहकों को उनके नाम से पुकारें और आत्मीयता से स्वागत करें।'
  },
  {
    id: 17,
    en: 'Cleanliness in thought, speech, and dispensary is next to godliness.',
    hi: 'विचार, वाणी और कार्यस्थल की स्वच्छता ही ईश्वर की सच्ची आराधना है।',
    authorEn: 'Mahatma Gandhi',
    authorHi: 'महात्मा गांधी',
    category: 'excellence',
    categoryLabelEn: 'Hygiene & Cleanliness',
    categoryLabelHi: 'स्वच्छता एवं शुद्धता',
    tipEn: 'Sanitize dispensing trays and counters at the start of every shift.',
    tipHi: 'प्रत्येक शिफ्ट की शुरुआत में काउंटर और डिस्पेंसिंग ट्रे को साफ व सैनिटाइज करें।'
  },
  {
    id: 18,
    en: 'Health is a state of complete harmony of the body, mind, and spirit.',
    hi: 'स्वास्थ्य शरीर, मन और आत्मा के संपूर्ण सामंजस्य की अवस्था है।',
    authorEn: 'B.K.S. Iyengar',
    authorHi: 'बी.के.एस. अयंगर',
    category: 'healing',
    categoryLabelEn: 'Holistic Harmony',
    categoryLabelHi: 'समग्र संतुलन',
    tipEn: 'Encourage daily morning walks and light yoga alongside maintenance medicines.',
    tipHi: 'मरीजों को दवाइयों के साथ नियमित सुबह की सैर व हल्के योग के लिए प्रेरित करें।'
  },
  {
    id: 19,
    en: 'Trust is the most valuable medicine in a pharmacy.',
    hi: 'विश्वास ही फार्मेसी की सबसे अनमोल और असरदार औषधि है।',
    authorEn: 'Pharmacist Creed',
    authorHi: 'फार्मेसी संकल्प',
    category: 'service',
    categoryLabelEn: 'Trust & Integrity',
    categoryLabelHi: 'विश्वास एवं ईमानदारी',
    tipEn: 'Always be honest about genuine generic equivalents and transparent pricing.',
    tipHi: 'जेनेरिक विकल्पों और उचित मूल्य निर्धारण के बारे में हमेशा पारदर्शी रहें।'
  },
  {
    id: 20,
    en: 'Small daily improvements over time lead to stunning professional results.',
    hi: 'प्रतिदिन किए गए छोटे-छोटे सुधार समय के साथ अद्भुत परिणाम लाते हैं।',
    authorEn: 'Robin Sharma',
    authorHi: 'रॉबिन शर्मा',
    category: 'excellence',
    categoryLabelEn: 'Continuous Growth',
    categoryLabelHi: 'निरंतर प्रगति',
    tipEn: 'Review one new drug monograph or pharmacology update daily.',
    tipHi: 'प्रतिदिन किसी एक नई दवा या फार्मूलेशन की जानकारी का अध्ययन करें।'
  },
  {
    id: 21,
    en: 'A kind word is like a spring day; it warms the soul and eases the pain.',
    hi: 'मधुर वचन वसंत ऋतु की भांति होते हैं, जो मन को सांत्वना और पीड़ा में राहत देते हैं।',
    authorEn: 'Indian Proverb',
    authorHi: 'भारतीय लोकोक्ति',
    category: 'empathy',
    categoryLabelEn: 'Kindness',
    categoryLabelHi: 'मधुर वाणी',
    tipEn: 'Use reassuring words like "Aap jaldi theek ho jayenge" (Get well soon).',
    tipHi: 'मरीज को हमेशा "आप शीघ्र स्वस्थ होंगे" जैसे संबल देने वाले शब्द कहें।'
  },
  {
    id: 22,
    en: 'Proper medication storage preserves life-saving potency.',
    hi: 'दवाइयों का सही भंडारण उनकी जीवनरक्षक क्षमता को सुरक्षित रखता है।',
    authorEn: 'Good Pharmacy Practice',
    authorHi: 'उत्तम फार्मेसी अभ्यास',
    category: 'precision',
    categoryLabelEn: 'Storage Standards',
    categoryLabelHi: 'उचित भंडारण',
    tipEn: 'Monitor and log refrigerator temperatures (2°C to 8°C) every morning and evening.',
    tipHi: 'फ्रिज का तापमान (2°C से 8°C) रोज सुबह-शाम चेक करके लॉग बुक में दर्ज करें।'
  },
  {
    id: 23,
    en: 'The secret of health for both mind and body is to live in the present moment wisely.',
    hi: 'मन और शरीर के स्वास्थ्य का रहस्य वर्तमान क्षण में सजगता और विवेक से जीना है।',
    authorEn: 'Gautama Buddha',
    authorHi: 'गौतम बुद्ध',
    category: 'wellness',
    categoryLabelEn: 'Mindfulness',
    categoryLabelHi: 'सजगता व ध्यान',
    tipEn: 'Stay fully present while preparing prescriptions to eliminate dispensing errors.',
    tipHi: 'दवा पैक करते समय पूरा ध्यान उसी पर रखें ताकि गलती की कोई गुंजाइश न रहे।'
  },
  {
    id: 24,
    en: 'To serve the suffering with dedication is the highest devotion.',
    hi: 'पीड़ित और जरूरतमंद की निष्ठा से सेवा करना ही ईश्वर की सच्ची भक्ति है।',
    authorEn: 'Swami Vivekananda',
    authorHi: 'स्वामी विवेकानन्द',
    category: 'service',
    categoryLabelEn: 'Selfless Service',
    categoryLabelHi: 'निस्वार्थ सेवा',
    tipEn: 'Provide priority service to emergency patients and senior citizens.',
    tipHi: 'आपातकालीन मरीजों और वरिष्ठ नागरिकों को प्राथमिकता के साथ सेवा दें।'
  },
  {
    id: 25,
    en: 'An ounce of prevention is worth a pound of cure.',
    hi: 'बचाव का एक उपाय, इलाज के सौ उपायों से कहीं बेहतर और असरदार होता है।',
    authorEn: 'Benjamin Franklin',
    authorHi: 'बेंजामिन फ्रैंकलिन',
    category: 'wisdom',
    categoryLabelEn: 'Prevention',
    categoryLabelHi: 'रोकथाम एवं बचाव',
    tipEn: 'Encourage routine blood pressure and glucose monitoring for adults over 40.',
    tipHi: '40 वर्ष से अधिक उम्र के लोगों को नियमित बीपी और शुगर जांच के लिए प्रेरित करें।'
  },
  {
    id: 26,
    en: 'Integrity is doing the right thing, even when no one is watching.',
    hi: 'सत्यनिष्ठा वह है जब कोई न देख रहा हो, तब भी सही कार्य किया जाए।',
    authorEn: 'C.S. Lewis',
    authorHi: 'सी.एस. लुईस',
    category: 'excellence',
    categoryLabelEn: 'Integrity & Ethics',
    categoryLabelHi: 'सत्यनिष्ठा व ईमानदारी',
    tipEn: 'Never dispense Schedule H1 or Narcotic drugs without a valid original prescription.',
    tipHi: 'बिना वैध पर्चे के शेड्यूल H1 या प्रतिबंधित दवाइयां कभी न दें।'
  },
  {
    id: 27,
    en: 'Healing is a matter of time, but it is sometimes also a matter of opportunity and kindness.',
    hi: 'रोगमुक्ति समय मांगती है, परंतु कई बार यह संवेदनशीलता और अपनापन से भी संभव होती है।',
    authorEn: 'Hippocrates',
    authorHi: 'हिप्पोक्रेट्स',
    category: 'healing',
    categoryLabelEn: 'Healing Process',
    categoryLabelHi: 'स्वास्थ्य लाभ',
    tipEn: 'Ask patients if they have any known allergies before dispensing antibiotics.',
    tipHi: 'एंटीबायोटिक या नई दवा देने से पहले मरीज से किसी एलर्जी के बारे में पूछें।'
  },
  {
    id: 28,
    en: 'The art of healing comes from nature, not from the physician alone.',
    hi: 'आरोग्य की शक्ति प्रकृति से आती है, केवल चिकित्सक या दवा से नहीं।',
    authorEn: 'Paracelsus',
    authorHi: 'पैरासेल्सस',
    category: 'wellness',
    categoryLabelEn: 'Natural Harmony',
    categoryLabelHi: 'प्राकृतिक स्वास्थ्य',
    tipEn: 'Remind customers of the importance of good sleep and seasonal hydration.',
    tipHi: 'ग्राहकों को अच्छी नींद और मौसम के अनुसार पानी पीने का महत्व याद दिलाएं।'
  },
  {
    id: 29,
    en: 'Clear communication is the first line of defense against medication errors.',
    hi: 'स्पष्ट संवाद ही दवाइयों की गलतियों से बचने की पहली सुरक्षा पंक्ति है।',
    authorEn: 'Clinical Safety Protocol',
    authorHi: 'क्लीनिकल सुरक्षा नियम',
    category: 'precision',
    categoryLabelEn: 'Clear Communication',
    categoryLabelHi: 'स्पष्ट संवाद',
    tipEn: 'Write dose frequency clearly on the medicine packet in Hindi or local language.',
    tipHi: 'दवा के पैकेट पर खुराक का समय (सुबह/दोपहर/रात) स्पष्ट अक्षरों में लिखें।'
  },
  {
    id: 30,
    en: 'Gratitude turns what we have into enough, and more.',
    hi: 'कृतज्ञता और संतोष हमारे पास जो है उसे पर्याप्त और समृद्ध बना देते हैं।',
    authorEn: 'Aesop',
    authorHi: 'ईसप',
    category: 'wisdom',
    categoryLabelEn: 'Gratitude',
    categoryLabelHi: 'कृतज्ञता एवं संतोष',
    tipEn: 'Start your pharmacy shift with a grateful mind and ready willingness to help.',
    tipHi: 'अपने कार्यदिवस की शुरुआत कृतज्ञ मन और सहायता के सकारात्मक भाव से करें।'
  },
  {
    id: 31,
    en: 'May all beings be free from disease, and may all behold what is auspicious.',
    hi: 'सर्वे भवन्तु सुखिनः सर्वे सन्तु निरामयाः। सर्वे भद्राणि पश्यन्तु मा कश्चिद्दुःखभाग्भवेत्॥',
    authorEn: 'Brihadaranyaka Upanishad',
    authorHi: 'बृहदारण्यक उपनिषद्',
    category: 'service',
    categoryLabelEn: 'Universal Well-being',
    categoryLabelHi: 'सर्वकल्याण प्रार्थना',
    tipEn: 'Treat every patient with the same dedication and respect you would give to family.',
    tipHi: 'हर मरीज की सेवा उसी आत्मीयता से करें जैसे आप अपने परिवारजन की करते हैं।'
  }
];

/**
 * Deterministically computes the day index of the year (1 - 366)
 */
export function getDayOfYear(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - startOfYear.getTime()) + ((startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Returns today's daily quote (dynamically rotating every single day based on date)
 */
export function getDailyQuote(date: Date = new Date(), manualOffset: number = 0): DailyQuote {
  const dayOfYear = getDayOfYear(date);
  const total = DAILY_QUOTES.length;
  
  // Calculate zero-indexed index using day of year + manual offset + year variation
  const yearSalt = date.getFullYear() % 7;
  let index = (dayOfYear + yearSalt + manualOffset - 1) % total;
  if (index < 0) index = (index + total) % total;

  return DAILY_QUOTES[index] || DAILY_QUOTES[0];
}

/**
 * Formats today's date label (e.g., "Friday, 21 Aug 2026" or "शुक्रवार, 21 अगस्त")
 */
export function getFormattedTodayDate(isHindi: boolean = false, date: Date = new Date()): string {
  if (isHindi) {
    const days = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/**
 * LocalStorage favorites management
 */
const FAVORITES_STORAGE_KEY = 'satyam_favorite_quotes';

export function getFavoriteQuoteIds(): number[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteQuote(id: number): boolean {
  try {
    const favorites = getFavoriteQuoteIds();
    const index = favorites.indexOf(id);
    let updated: number[];
    let isNowFav: boolean;
    if (index >= 0) {
      updated = favorites.filter(favId => favId !== id);
      isNowFav = false;
    } else {
      updated = [...favorites, id];
      isNowFav = true;
    }
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
    return isNowFav;
  } catch {
    return false;
  }
}

export interface AiDailyWisdom {
  affirmationEn: string;
  affirmationHi: string;
  authorEn: string;
  authorHi: string;
  category: string;
  categoryLabelEn: string;
  categoryLabelHi: string;
  tipEn?: string;
  tipHi?: string;
  characterCount: {
    en: number;
    hi: number;
    maxLimit: number;
  };
  engine: string;
  isAiGenerated: boolean;
  generatedAt: string;
}

export async function fetchAiDailyWisdom(options: {
  theme?: string;
  pharmacistName?: string;
  focusTopic?: string;
  forceRefresh?: boolean;
} = {}): Promise<AiDailyWisdom> {
  const todayKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `satyam_ai_daily_wisdom_${options.theme || 'affirmation'}_${todayKey}`;

  if (!options.forceRefresh && !options.pharmacistName && !options.focusTopic) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.affirmationEn && parsed.affirmationEn.length <= 150) {
          return parsed;
        }
      }
    } catch {}
  }

  try {
    const response = await fetch('/api/ai/daily-wisdom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        theme: options.theme || 'affirmation',
        pharmacistName: options.pharmacistName,
        focusTopic: options.focusTopic,
        storeName: 'Satyam Medical Store',
        forceRefresh: options.forceRefresh
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data: AiDailyWisdom = await response.json();
    
    // Ensure strict 150 char limit client-side verification
    if (data.affirmationEn && data.affirmationEn.length > 150) {
      data.affirmationEn = data.affirmationEn.slice(0, 147) + '...';
    }
    if (data.affirmationHi && data.affirmationHi.length > 150) {
      data.affirmationHi = data.affirmationHi.slice(0, 147) + '...';
    }

    // Save to local cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {}

    return data;
  } catch (err) {
    console.warn("Using offline fallback daily affirmation:", err);
    // Return high quality verified fallback <= 150 chars
    return {
      affirmationEn: "Precision in medicine is the highest service. Every label checked protects a life today.",
      affirmationHi: "दवा में सटीकता ही सर्वोच्च सेवा है। आज जांची गई हर खुराक किसी जीवन की सुरक्षा करती है।",
      authorEn: "Clinical Pharmacy Lore",
      authorHi: "फार्मेसी परंपरा",
      category: "precision",
      categoryLabelEn: "Precision & Accuracy",
      categoryLabelHi: "सटीकता व सुरक्षा",
      tipEn: "Double-check pediatric doses and expiry dates before dispensing.",
      tipHi: "दवा देने से पहले बच्चों की खुराक और एक्सपायरी तिथि दोबारा जांचें।",
      characterCount: {
        en: 88,
        hi: 88,
        maxLimit: 150
      },
      engine: "client_fallback",
      isAiGenerated: false,
      generatedAt: new Date().toISOString()
    };
  }
}

