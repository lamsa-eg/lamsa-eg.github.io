const FORMS={
  breakSeal:{f:"اكسري الختم",m:"اكسر الختم",n:"افتح الختم"},
  skip:{f:"افتحيها على طول",m:"افتحها على طول",n:"افتح المفاجأة على طول"},
  wonBefore:{f:"✓ اتحلّت قبل كده",m:"✓ اتحلّت قبل كده",n:"✓ اللعبة اتحلّت قبل كده"},
  lockedReward:{f:"فيه مفاجأة مستخبية هنا، هتظهر لما تكسبي",m:"فيه مفاجأة مستخبية هنا، هتظهر لما تكسب",n:"فيه مفاجأة مستخبية هنا، هتظهر بعد الحل"},
  firstDay:{f:"افتكري أول يوم",m:"افتكر أول يوم",n:"أول يوم في الحكاية"},
  ready:{f:"جاهزة؟",m:"جاهز؟",n:"جاهزين؟"}
};
export function receiverCopy(memory,key){const gender=["m","f"].includes(memory?.recipientGender)?memory.recipientGender:"n";return FORMS[key]?.[gender]||FORMS[key]?.n||key}
