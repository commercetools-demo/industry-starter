/** German (de-DE) copy for the 12 services. Same shape and array lengths as the en-US content in `services.ts`. */
export interface ServiceCopy {
  name: string;
  summary: string;
  included: string[];
  steps: string[];
  records: string[];
  faq: { question: string; answer: string }[];
}

export const SERVICES_DE: Record<string, ServiceCopy> = {
  'pipe-installation-repair': {
    name: 'Rohrinstallation & Reparatur',
    summary: 'Haupt-, Prozess- und Verteilleitungen aus Stahl, Kupfer und PE. Geplante Stillstandsarbeiten mit Absperrplänen.',
    included: ['Standortbegehung und schriftlicher Leistungsumfang vor Arbeitsbeginn', 'Installation oder Reparatur in Stahl, Kupfer und PE', 'Absperr- und Stillstandsplan, abgestimmt mit Ihrem Standortteam', 'Druckprüfung, Spülung und Inbetriebnahme'],
    steps: ['Wir begehen den Standort und stimmen Umfang und Stillstandsfenster ab', 'Unsere Monteure sperren ab, installieren oder reparieren und prüfen die Leitungen', 'Wir nehmen in Betrieb, dokumentieren die Ergebnisse und übergeben die Bestandsunterlagen'],
    records: ['Druckprüfzeugnis', 'Bestandsdokumentation der Rohrleitungen', 'Absperrplan'],
    faq: [
      { question: 'Können Sie außerhalb der Produktionszeiten arbeiten?', answer: 'Ja. Stillstandsarbeiten werden um Ihre Produktions- oder Öffnungszeiten herum geplant, auch nachts und am Wochenende.' },
      { question: 'Mit welchen Werkstoffen arbeiten Sie?', answer: 'Stahl, Kupfer und PE für Haupt-, Prozess- und Verteilleitungen.' },
      { question: 'Bieten Sie Notfallreparaturen an?', answer: 'Vertragskunden erhalten über die 24/7-Hotline eine Notfallreaktion innerhalb von 4 Stunden.' },
    ],
  },
  'drain-cleaning-cctv-survey': {
    name: 'Kanalreinigung & TV-Inspektion',
    summary: 'Hochdruckspülung und aufgezeichnete TV-Inspektionen mit zustandsbewerteten Berichten.',
    included: ['Hochdruckspülung von Abwasserleitungen und Abläufen', 'Aufgezeichnete TV-Inspektion der Leitungsabschnitte', 'Zustandsbewerteter Bericht mit Fotos', 'Empfohlene Reparaturen nach Priorität'],
    steps: ['Wir stimmen Zugang und zu untersuchende Leitungen ab', 'Wir spülen und reinigen, fahren dann die Kamera und zeichnen die Inspektion auf', 'Sie erhalten den bewerteten Bericht im Kundenportal'],
    records: ['TV-Inspektionsbericht', 'Zustandsbewertung je Haltung', 'Reinigungsprotokoll'],
    faq: [
      { question: 'Wie wird der Zustand bewertet?', answer: 'Jede Haltung wird von 1 (gut) bis 5 (eingestürzt) bewertet, Schäden werden fotografiert.' },
      { question: 'Wie lange dauert eine Inspektion?', answer: 'Ein typischer Gewerbestandort dauert einen Tag; größere Standorte werden in Abschnitten geplant.' },
      { question: 'Lässt sich das regelmäßig einplanen?', answer: 'Ja, vierteljährliche oder jährliche Reinigungs- und Inspektionstermine können als Rahmenvertrag eingerichtet werden.' },
    ],
  },
  'backflow-water-testing': {
    name: 'Rückflussverhinderer & Wasserprüfung',
    summary: 'Prüfung von Rückflussverhinderern, Legionellen-Gefährdungsbeurteilungen und Trinkwasserproben.',
    included: ['Inspektion und Prüfung von Rückflussverhinderern', 'Legionellen-Gefährdungsbeurteilung', 'Wasserproben und Laboranalyse', 'Empfehlungen zur Mängelbeseitigung'],
    steps: ['Wir erfassen Ihre Rückflussverhinderer und Probenahmestellen', 'Wir prüfen und nehmen Proben nach dem vereinbarten Plan', 'Ergebnisse und Maßnahmen werden auditfähig dokumentiert'],
    records: ['Prüfbescheinigung Rückflussverhinderer', 'Legionellen-Gefährdungsbeurteilung', 'Wasserprobenergebnisse'],
    faq: [
      { question: 'Wer braucht eine Prüfung von Rückflussverhinderern?', answer: 'Standorte mit Rückflussverhinderern in der Wasserversorgung, darunter Produktions-, Gesundheits- und Lebensmittelbetriebe.' },
      { question: 'Wie oft prüfen wir?', answer: 'In der Regel jährlich, bei Systemen mit höherem Risiko wie Wassersystemen im Gesundheitswesen vierteljährlich.' },
      { question: 'Sind die Ergebnisse auditfähig?', answer: 'Ja. Bescheinigungen und Ergebnisse liegen für Prüfungen im Kundenportal bereit.' },
    ],
  },
  'boiler-hot-water': {
    name: 'Heizkessel & Warmwasser',
    summary: 'Gewerbliche Heizkessel, Warmwasserspeicher und Warmwassersysteme: Wartung, Reparatur, Austausch.',
    included: ['Jährliche Wartung gewerblicher Heizkessel und Warmwasserspeicher', 'Fehlersuche und Reparatur', 'Planung und Einbau von Ersatzanlagen', 'Kontrolle von Warmwassertemperatur und Sicherheit'],
    steps: ['Wir prüfen die Anlage und vereinbaren einen Wartungs- oder Austauschplan', 'Wir warten, reparieren oder ersetzen mit minimaler Störung', 'Wir prüfen, nehmen in Betrieb und dokumentieren die Systemeinstellungen'],
    records: ['Wartungsprotokoll', 'Sicherheitsprüfbescheinigung', 'Inbetriebnahmeprotokoll'],
    faq: [
      { question: 'Ersetzen Sie auch, nicht nur warten?', answer: 'Ja. Wir planen, liefern und installieren Ersatz für Heizkessel, Warmwasserspeicher und Warmwassersysteme.' },
      { question: 'Geht das ohne Warmwasserausfall?', answer: 'Wo möglich teilen wir die Arbeiten in Phasen auf oder stellen eine Übergangsversorgung bereit, damit der Betrieb weiterläuft.' },
      { question: 'Decken Sie die Gassicherheit ab?', answer: 'Die Arbeiten werden von qualifizierten Monteuren ausgeführt und für den Nachweis dokumentiert.' },
    ],
  },
  'commercial-fit-outs': {
    name: 'Gewerblicher Ausbau',
    summary: 'Roh- und Fertiginstallation für Büros, Werke, Stationen und Ladenflächen.',
    included: ['Rohinstallation und Fertiginstallation Sanitär', 'Sanitärobjekte und Waschanlagen', 'Abstimmung mit dem Generalunternehmer', 'Prüfung und Übergabedokumente'],
    steps: ['Wir prüfen die Pläne und stimmen den Zeitplan mit Ihrem Generalunternehmer ab', 'Wir führen Roh- und Fertiginstallation in den vereinbarten Bauabschnitten aus', 'Wir prüfen, beseitigen Restmängel und übergeben mit vollständiger Dokumentation'],
    records: ['Prüf- und Inbetriebnahmebescheinigungen', 'Übergabemappe', 'Bestandspläne'],
    faq: [
      { question: 'Können Sie mit unserem Generalunternehmer zusammenarbeiten?', answer: 'Ja. Wir stimmen Zeitplan, Zugang und Abnahme mit dem Generalunternehmer ab.' },
      { question: 'Bauen Sie auch klinische Bereiche aus?', answer: 'Ja, einschließlich Stationen und klinischer Waschanlagen mit den erforderlichen Maßnahmen zur Wassersicherheit.' },
      { question: 'Gibt es danach Wartung?', answer: 'Ja, ein planmäßiger Wartungsvertrag kann mit der Übergabe beginnen.' },
    ],
  },
  'general-waste-collection': {
    name: 'Gewerbeabfallentsorgung',
    summary: 'Planmäßige Abholung nach Standortvolumen, mit Behälter- und Presscontainer-Optionen.',
    included: ['Planmäßige Abholungen nach Ihrem Volumen', 'Tonnen, Mulden oder Presscontainer', 'Abhol- und Wiegenachweise', 'Flexible Zusatzabholungen'],
    steps: ['Wir erfassen Ihre Mengen und vereinbaren Behälter und Turnus', 'Unsere Teams holen planmäßig ab und erfassen die Gewichte', 'Sie prüfen Abholungen und Kosten im Kundenportal'],
    records: ['Entsorgungsnachweise', 'Abhol- und Gewichtsprotokoll', 'Monatsübersicht'],
    faq: [
      { question: 'Können wir den Turnus ändern?', answer: 'Ja. Turnus und Behältergrößen lassen sich anpassen, wenn sich Ihre Mengen ändern.' },
      { question: 'Bieten Sie Presscontainer an?', answer: 'Ja, je nach Volumen sind Tonnen, Mulden und Presscontainer verfügbar.' },
      { question: 'Gibt es Entsorgungsnachweise?', answer: 'Ja, für jede Abholung ein Entsorgungsnachweis, digital abgelegt.' },
    ],
  },
  recycling: {
    name: 'Recycling',
    summary: 'Getrennte Wertstoffströme für Karton, Kunststoffe, Metalle und Glas mit monatlicher Quotenberichterstattung.',
    included: ['Getrennte Ströme für Karton, Kunststoffe, Metalle und Glas', 'Trennhinweise und Mitarbeiterunterweisungen', 'Monatliche Recycling- und Verwertungsquotenberichte', 'Jährlicher Abfallvermeidungsplan'],
    steps: ['Wir prüfen Ihre Abfallströme und richten die Trennung ein', 'Wir holen jeden Strom ab und wiegen ihn', 'Sie erhalten monatlich die Verwertungsquoten'],
    records: ['Recyclingzertifikate', 'Monatlicher Verwertungsquotenbericht', 'Gewichtsprotokoll je Strom'],
    faq: [
      { question: 'Was kann recycelt werden?', answer: 'Karton, Kunststoffe, Metalle und Glas, abgeholt als getrennte Ströme.' },
      { question: 'Wie wird die Verwertungsquote ermittelt?', answer: 'Recycelte Gewichte geteilt durch die gesamten abgeholten Gewichte, monatlich berichtet.' },
      { question: 'Helfen Sie Mitarbeitenden bei der richtigen Trennung?', answer: 'Ja, mit Beschilderung und Unterweisungen vor Ort.' },
    ],
  },
  'hazardous-waste': {
    name: 'Gefährliche Abfälle',
    summary: 'Zugelassene Abholung von Ölen, Lösemitteln, Chemikalien und Batterien mit Begleitscheinen.',
    included: ['Zugelassene Abholung von Ölen, Lösemitteln, Chemikalien und Batterien', 'Hinweise zu Verpackung und Kennzeichnung', 'Begleitschein für jede Abholung', 'Behandlung nur in zugelassenen Anlagen'],
    steps: ['Wir klassifizieren Ihre Abfälle und vereinbaren Verpackung und Kennzeichnung', 'Ein zugelassener Fahrer holt ab und stellt den Begleitschein aus', 'Wir verfolgen den Abfall bis zur zugelassenen Behandlung und schließen den Nachweis ab'],
    records: ['Begleitscheine', 'Angaben zur Beförderungserlaubnis', 'Behandlungsbestätigung'],
    faq: [
      { question: 'Was müssen wir bereitstellen?', answer: 'Abfallarten und Mengen sowie, wo erforderlich, Ihre Standortgenehmigung oder Erzeugernummer.' },
      { question: 'Wer behandelt den Abfall?', answer: 'Ausschließlich zugelassene Behandlungsanlagen, vermerkt auf dem Begleitschein.' },
      { question: 'Können Sie kurzfristig abholen?', answer: 'Einmalige Abholungen lassen sich nach der Klassifizierung meist schnell einrichten.' },
    ],
  },
  'grease-trap-servicing': {
    name: 'Fettabscheider-Service',
    summary: 'Planmäßiges Entleeren und Reinigen für Küchen und Lebensmittelproduktion.',
    included: ['Planmäßiges Entleeren und Reinigen von Fettabscheidern', 'Entsorgung in einer zugelassenen Anlage', 'Serviceprotokoll nach jedem Besuch', 'Beratung zur Reduzierung von Fetten und Ölen'],
    steps: ['Wir erfassen Ihre Abscheider und vereinbaren den Turnus', 'Wir entleeren, reinigen und prüfen jeden Abscheider', 'Wir dokumentieren den Besuch und entsorgen den Abfall vorschriftsgemäß'],
    records: ['Serviceprotokoll je Besuch', 'Entsorgungsnachweise', 'Inspektionsnotizen'],
    faq: [
      { question: 'Wie oft sollten Abscheider entleert werden?', answer: 'Monatlich oder vierteljährlich je nach Küchenleistung; nach dem ersten Besuch empfehlen wir einen Turnus.' },
      { question: 'Betreuen Sie Lebensmittelproduktionsstätten?', answer: 'Ja, Küchen und Lebensmittelproduktionsbetriebe.' },
      { question: 'Ist die Entsorgung inbegriffen?', answer: 'Ja, der Abfall geht an eine zugelassene Anlage und wird dokumentiert.' },
    ],
  },
  'medical-clinical-waste': {
    name: 'Medizinische / klinische Abfälle',
    summary: 'Getrennte, nachverfolgte Abholung für Praxen, Labore und Pflegeeinrichtungen.',
    included: ['Getrennte Behälter für klinische Abfallströme', 'Nachverfolgte Abholung vom Standort bis zur Behandlung', 'Hinweise zu Trennung und Lagerung für Mitarbeitende', 'Auditfähige Nachweise für Prüfungen'],
    steps: ['Wir prüfen Ihre Abfallströme und stellen Behälter bereit', 'Geschulte Fahrer holen ab und verfolgen jeden Behälter', 'Sie laden die Nachweise für Audits im Kundenportal herunter'],
    records: ['Begleitscheine', 'Verfolgungs- und Behandlungsnachweise', 'Jahresabfallbericht'],
    faq: [
      { question: 'Welche Einrichtungen betreuen Sie?', answer: 'Praxen, Labore und Pflegeeinrichtungen.' },
      { question: 'Wird jeder Behälter verfolgt?', answer: 'Ja, von Ihrem Standort bis zur Endbehandlung, mit Nachweisen für Audits.' },
      { question: 'Schulen Sie unsere Mitarbeitenden?', answer: 'Hinweise zu Trennung und Lagerung geben wir auf Anfrage.' },
    ],
  },
  'liquid-waste-tankering': {
    name: 'Flüssigabfälle & Tankwagen',
    summary: 'Tankwagenabholung von Prozessabwasser, Schlamm und Abscheiderinhalten.',
    included: ['Tankwagenabholung von Prozessabwasser und Schlamm', 'Entleerung von Abscheidern und Separatoren', 'Entsorgung in zugelassenen Behandlungsanlagen', 'Dokumentation für jede Ladung'],
    steps: ['Wir analysieren den Flüssigabfall und stimmen Handhabung und Genehmigungen ab', 'Ein Tankwagen holt nach dem vereinbarten Plan ab', 'Wir dokumentieren die Ladung und bestätigen die Behandlung'],
    records: ['Begleitscheine', 'Ladungsnachweise', 'Behandlungsbestätigung'],
    faq: [
      { question: 'Welche Flüssigkeiten nehmen Sie an?', answer: 'Prozessabwasser, Schlamm und Abscheiderinhalte, vorbehaltlich der Klassifizierung.' },
      { question: 'Können Tankwagen unseren Standort erreichen?', answer: 'Zugang und Anschlüsse prüfen wir bei der Begehung.' },
      { question: 'Bieten Sie einmalige Abholungen an?', answer: 'Ja, ebenso monatliche und vierteljährliche Pläne.' },
    ],
  },
  'compliance-reporting': {
    name: 'Compliance-Berichte',
    summary: 'Entsorgungsnachweise, Prüfpfade und Jahresberichte in einem Portal.',
    included: ['Entsorgungs- und Begleitnachweise digital abgelegt', 'Monatliche Recycling- und Verwertungsquotenberichte', 'Auditfähige Nachweise für ISO- und behördliche Prüfungen', 'Jährlicher Abfallvermeidungsplan'],
    steps: ['Wir verbinden Ihre Abholungen mit Ihrem Kundenportal-Konto', 'Nachweise entstehen automatisch mit jeder Abholung', 'Sie exportieren Berichte für Audits und Ihre Jahresauswertung'],
    records: ['Entsorgungsnachweise', 'Verwertungsquotenberichte', 'Jahresabfallbericht'],
    faq: [
      { question: 'Wo finde ich meine Nachweise?', answer: 'Im Kundenportal, nach Standort, Abfallart und Datum.' },
      { question: 'Decken die Berichte alle Abfallströme ab?', answer: 'Ja, jeden Strom, der unter Ihrem Vertrag abgeholt wird.' },
      { question: 'Kann ich Berichte mit Prüfern teilen?', answer: 'Ja. Dokumente lassen sich als PDF herunterladen.' },
    ],
  },
};
