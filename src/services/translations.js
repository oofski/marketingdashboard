// Translations for consent forms. Keys map to a labeled paragraph used in PDFs.
// Add a new language by adding another entry with the same shape.

export const LANGUAGES = {
  en: { label: 'English', code: 'en' },
  es: { label: 'Español', code: 'es' },
  fr: { label: 'Français', code: 'fr' },
};

export const CONSENT_TEMPLATES = {
  en: {
    title: 'Patient Consent and Treatment Authorization',
    intro:
      'I, the undersigned, hereby authorize the doctor and clinic staff to perform the dental examination, ' +
      'treatment, and necessary procedures discussed during my visit. I understand the nature of the proposed ' +
      'treatment and its purpose.',
    sections: [
      {
        heading: 'Acknowledgment of Risks',
        body:
          'I understand that all dental procedures carry inherent risks, including but not limited to pain, swelling, ' +
          'infection, allergic reactions to medications, sensitivity, and in rare cases, more serious complications. ' +
          'These risks have been explained to me and I have had the opportunity to ask questions.',
      },
      {
        heading: 'Medical History',
        body:
          'I confirm that I have provided complete and accurate information regarding my medical history, allergies, ' +
          'and current medications. I will promptly inform the clinic of any changes to this information.',
      },
      {
        heading: 'Privacy Notice (HIPAA)',
        body:
          'I acknowledge that I have been informed of the clinic privacy practices. My health information will be ' +
          'kept confidential and used only for treatment, payment, and clinic operations as permitted by law.',
      },
      {
        heading: 'Financial Responsibility',
        body:
          'I understand that I am responsible for all charges associated with my dental care, regardless of insurance ' +
          'coverage. Payment is due at the time of service unless other arrangements have been made.',
      },
      {
        heading: 'Authorization to Treat',
        body:
          'I authorize the clinic to perform the necessary dental procedures, including the use of local anesthesia, ' +
          'radiographs, and any other diagnostic or treatment measures deemed appropriate.',
      },
    ],
    signatureLine: 'Patient signature',
    dateLine: 'Date',
    nameLine: 'Printed name',
  },
  es: {
    title: 'Consentimiento del Paciente y Autorización de Tratamiento',
    intro:
      'Yo, el/la abajo firmante, autorizo al doctor y al personal de la clínica a realizar el examen dental, ' +
      'tratamiento y procedimientos necesarios discutidos durante mi visita. Entiendo la naturaleza del ' +
      'tratamiento propuesto y su propósito.',
    sections: [
      {
        heading: 'Reconocimiento de Riesgos',
        body:
          'Entiendo que todos los procedimientos dentales conllevan riesgos inherentes, incluyendo pero no limitados a ' +
          'dolor, hinchazón, infección, reacciones alérgicas a medicamentos, sensibilidad y, en casos raros, ' +
          'complicaciones más graves. Estos riesgos me han sido explicados y he tenido la oportunidad de hacer preguntas.',
      },
      {
        heading: 'Historial Médico',
        body:
          'Confirmo que he proporcionado información completa y precisa sobre mi historial médico, alergias y ' +
          'medicamentos actuales. Informaré a la clínica de inmediato sobre cualquier cambio a esta información.',
      },
      {
        heading: 'Aviso de Privacidad (HIPAA)',
        body:
          'Reconozco que se me ha informado sobre las prácticas de privacidad de la clínica. Mi información de salud ' +
          'se mantendrá confidencial y se utilizará solo para tratamiento, pago y operaciones de la clínica según lo ' +
          'permita la ley.',
      },
      {
        heading: 'Responsabilidad Financiera',
        body:
          'Entiendo que soy responsable de todos los cargos asociados con mi cuidado dental, independientemente de la ' +
          'cobertura del seguro. El pago se debe realizar en el momento del servicio a menos que se hayan hecho ' +
          'otros arreglos.',
      },
      {
        heading: 'Autorización para Tratar',
        body:
          'Autorizo a la clínica a realizar los procedimientos dentales necesarios, incluyendo el uso de anestesia ' +
          'local, radiografías y cualquier otra medida diagnóstica o de tratamiento que se considere apropiada.',
      },
    ],
    signatureLine: 'Firma del paciente',
    dateLine: 'Fecha',
    nameLine: 'Nombre en letra de imprenta',
  },
  fr: {
    title: 'Consentement du Patient et Autorisation de Traitement',
    intro:
      'Je, soussigné(e), autorise par la présente le médecin et le personnel de la clinique à effectuer ' +
      "l'examen dentaire, le traitement et les procédures nécessaires discutés lors de ma visite. Je comprends " +
      'la nature du traitement proposé et son objectif.',
    sections: [
      {
        heading: 'Reconnaissance des Risques',
        body:
          'Je comprends que toutes les procédures dentaires comportent des risques inhérents, y compris mais non ' +
          "limités à la douleur, l'enflure, l'infection, les réactions allergiques aux médicaments, la sensibilité et, " +
          'dans de rares cas, des complications plus graves. Ces risques m\'ont été expliqués et j\'ai eu l\'occasion ' +
          'de poser des questions.',
      },
      {
        heading: 'Antécédents Médicaux',
        body:
          "Je confirme avoir fourni des informations complètes et exactes concernant mes antécédents médicaux, mes " +
          "allergies et mes médicaments actuels. J'informerai promptement la clinique de tout changement à ces " +
          'informations.',
      },
      {
        heading: 'Avis de Confidentialité (HIPAA)',
        body:
          "Je reconnais avoir été informé(e) des pratiques de confidentialité de la clinique. Mes informations de santé " +
          'resteront confidentielles et ne seront utilisées que pour le traitement, le paiement et les opérations de ' +
          'la clinique tels que permis par la loi.',
      },
      {
        heading: 'Responsabilité Financière',
        body:
          'Je comprends que je suis responsable de tous les frais associés à mes soins dentaires, indépendamment de la ' +
          'couverture d\'assurance. Le paiement est dû au moment du service, sauf si d\'autres arrangements ont été pris.',
      },
      {
        heading: 'Autorisation de Traiter',
        body:
          "J'autorise la clinique à effectuer les procédures dentaires nécessaires, y compris l'utilisation d'anesthésie " +
          'locale, de radiographies et de toute autre mesure diagnostique ou thérapeutique jugée appropriée.',
      },
    ],
    signatureLine: 'Signature du patient',
    dateLine: 'Date',
    nameLine: 'Nom en caractères d\'imprimerie',
  },
};

export const UI_STRINGS = {
  en: {
    please_sign: 'Please sign below',
    clear: 'Clear',
    save: 'Save',
    cancel: 'Cancel',
  },
  es: {
    please_sign: 'Por favor firme abajo',
    clear: 'Borrar',
    save: 'Guardar',
    cancel: 'Cancelar',
  },
  fr: {
    please_sign: 'Veuillez signer ci-dessous',
    clear: 'Effacer',
    save: 'Enregistrer',
    cancel: 'Annuler',
  },
};
