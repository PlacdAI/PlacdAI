import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";
import { AppNav } from "@/components/AppNav";
import type { Product } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Item = {
  id: string;
  public_url: string;
  storage_path: string;
  style: string | null;
  created_at: string;
  expires_at: string;
  products: Product[] | null;
};

export const Route = createFileRoute("/gallery")({
  head: () => ({ meta: [{ title: "Your gallery — PlacdAI" }] }),
  component: Gallery,
});

// 🔧 Embedded (not imported from @/assets) because the official logo
// asset has an opaque background — running it through the watermark's
// source-in tint produced a solid white square instead of the mark's
// shape. This is the same icon exported with a real transparent
// background, so tinting preserves its actual silhouette.
const WATERMARK_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAA5ZDbSAAAhMklEQVR4nO19e5hdVZXnb629z33WK4/KE5CHEkjsEJGHhNAJtiHDBz7ArtC2IHbTzgwq2LY92LQDt6p7mP4c/cAH6LQz02KPiFYp3Y4PRkCZYIBuFEMbQhAJCJIHSSWp5733PPZa88c559atxw0BEqh7P3/fd7+qe/Y55+69136utfZvERqDAYgxBl/96ldP+NrXvvbO7du3L+zu7m7r7Oxc6JzTIAhGRkZGxpmZisViMQzDcGhoaDQMQ7HWQkTAzMjn8/lsNusNDQ2NMDPNmTOnk4i49kPMyGazHUSUYWYlIjM4OLjLGOPNnTu3W0QcEeVVtSoiUi6Xn9qwYcO9H/3oR3+2dOnScvIaA8AdojyHDVVlIpL4/93FJx751UXj4yOnEiFjrNfNRJkociMqUVVAEQFtTKROdZxEnZBQWi6ALETzIJSdU2HDBcvkxb9EIADGmrwCOSirQlnFjQI8bi0vFEAJyAkQQcWJc/vmdHX9ZM5xSx+YM+eEIQAolUrc29urRKRTy0INymiY2d1www2r7rnnno+MjIy8p1KpzBcRiAhUFaqaFCAuiHMORARjDFQnfoeIICK1+1S19r2uQif9JaLavemnHp7ngZmjQqHwdFdXV//q1avv+vSnP/1vALhUKqGvr2/yD7wM9Pf3m40bNzrVfe2/+pdHPxxFcqVodKrnGRAIKgJonEeYJP+iAAFMlJQDADStAEAVxAwVhULjSq8lE1TjeqXkeSICiOCcABTXS/xuAhGh6lch4J3Gy/1TvqP9u8tWnndffd7ryzNVwASAPM+Tyy+//M8fe+yxvx0dHW2rVCpgZkla9dRntO5ZaJ004sxrmnFSVU3/rz08kY765+oLXPd+JaK0MRlVhbUWuVyufPzxx3/qvvvu+1wURUAy+swgv0Pi/vvvt+eff3705NZHzoyqI18twK2oVCqoVitKrEIA4hpIBFkbMCiuBiUliiuEQFDoRO2kV+P0pBIUmjSWpB3UqlOR/M60PqkAsbHGIpcvohwBsPkvrzz7/D8nomCqkKcKy1hr3aWXXnrNli1bvlAul+F5XiQiJpZNow7/ukCJSFVVVNVaa7Fw4cJvXnLJJZ/45Cc/uSvJ77Tqafgy7TdEG92TWx46t1IZusuKWxCUyxGIGOQ4bi8EBseDJhQ1UcWyS16E6dem/diUeyZ1EUwW6kzviBuCkqhz7HGho5MDx5u9YvFjy09b/Yv6KaY2D65du9Zaa92GDRv++mc/+9kXKpWKGmPEOWcBzDbhAvGIwKpqmVmjKIp27979R3feeeeP7rjjjvkUS/+wMt3fHwv3V1sevMgfP/gjDqsLgsqYUyar0LiOkmFTQBAiCDGUGKp1f7XBtamf2j0EBcV/0/9r3w/xDmIImNRYy+q4PLzfZbS6Jhod/smTv3jwTCKS/v5+A0y0DwPAXXjhhX/y5JNP/kMURS5ZBFE6106dB2cLpgzxAYDMokWL+h999NHLnHMvOVSnrf2JJ35+euXAi/d7LuxQf8wxGxOirqfWuhslsyjh8MeH6UgH+UPdcahUJYZCYeHA4gDV0Ct2eaPibeeTNpxxxlKqqCq4VCoxAHfRRRete/rpp2+NokiS7krx3DCxSJpNvbh+QVbX+DxVdfv379948cUX/xli4ZpG7yiVSkwEferf7j+msn/Pd6y4jjCoOhAbUcHksZORiiUVM+hVfg5dwkM+qyoTuWGCMnnl8dGozdNT+Zm7P5dknrivr0+ef/75/O7du/9HtVotJELkqZVY/302oL6x1f1PRETValV37Nhxyy233HI8AEka8TSsWLGCANLqaOW/dWT4+LBajkBshBhaE+hMn1cPRTyVH+pzKDApCAIBEMHAkQUZNn55yBVt9KGnH7nvQiISYmasXr36up07d346iqKIiOwRKcHrCFV1xhhzwgkn3Hb//fd/FDPskdOheesjm1ZrMP5AVB2DQhggYihIAZk9A9ZhgQgQVVfM57kc8UNv+f13/j57ngcAq8MwnHXL5JeDKXtvDsNQ9+3bd8njjz8+F4Cb2osHBgbirQrp26xlI+pA8a7ztc34EUKsLwAIZCpVn6LQnb196yNnc7Va9XzfPx5Hcvx5HZAqXYBknCbSarW65CMf+cjpAPDEE0/MWDaJopWQCC9jRzUrUd83VZxrK2btyND+C+xNN9102vDw8JumKiCaDfU9OFn5axiGmDt37ioA9w0MDNSnExGJ7txZ2LLjsbNIA7CCYi2GiRUOTSxwYoK4CBm2q/hb3/rWvwvDsIB4jmpaATdCtVo9ceq1gYEBBqBbn31quTpZFoaBkgpPjM6H3qLMdoiAnQvBkBNYVRelRoFWAxHB9/1Co/SKVDozGcsEFWq1ti0KVc0zMyeKr+k64WaHqsLzPL9RujUWTBFUInJsoGTAKiC41CTQtCAQWCngarXqJxYbnU373CMFz/MqjdKiKAhJXby9QLz3JSQKjiaWLxEpmKDEVc5ms9nkYhMXqTGstQ17MLHJEBhELdiyARDB52w2601R97UMEvt0tVE6C0yz7nsPBYWCicHEFc5kMmOvd4aOFhJ7cdAo3bD1RRSqaK3hq2aq1ICZudKKK+g6b5CG1iTK5yKJ72niXW9jiIrjuXPnJv5BzbysmBme56FQiHdJPT0909KLxvNaq+vGIIIyMwzbkLPZrDfVR6oVoKowxsAY03AfTMw5iv2c4nG6Rdq4AqSxTNut7/v51ztDRwPMjCAIMDQ0ZAGgXlWZwg8qGTbJ9ESJD1ULgEBw4gB2OR4ZGWlPHNxao3RTwMwNF5FBGGVjb8XD9O1pEqgqDBtAdZyDILDA7PLWOFJIFlntjdJbde9PlPRgoMDM7IDZ5a1xJGGMGWqURkRHxFF+9kHVGAYIB3loaGgw2Sa1pIRFpOEesOIHByLngKa3Bs8EAiksO+dabwmNCePJyMjINHNhCorCqBVHLlVwFEZwqidwPp8vJHNVS81H6fR6SFWlsdn4mAi0VbZIQGJsiP1zqjYIgmpSGS3XlFUV+Xx+vFG6UOSrKqAgpdbZBwPJOTDmcfY8b7cxBiLN5kN4eNi1a9cxjdJyXvtYGDoFiPHSnqpNA1Ul5wRRGC3m/fv31/bBrbhrGBkZmdsobawymmM2RCChFlpoUXIi0TmZw8cee2y6VeAWVVk23Ap1tLeFyXHI+ORjiwzRdQ1VeNGiRX56prfVejARobOzc5omq6enRwGAgUgVwkTUvB7RM0DjXmwNl/mpp57KOeeQ+ma1ElQVnZ2dQ1Ovp07vo+PlLDEZiU9wt1TrJmKAeJQLhcJQKy+ystlsw1V01stXE3qI+HD5a5ivo4l4PQUwocLDw8PFZO5tuR78Ui47kXMZIjJQKDW1q/t0JCdDK+z7vmnF+bdOQ9XQ6c6JcHJAqfVad4yARSQ9P9tSZUwdCcMw7Gx0D0vAnDoctpjKUkVApF2t54xVh3gv6Bp6dDhhphY0tKgqqSrEaZ6ttV4yRLfUGJ1ST3ieV250jyNXK3YrFT9VWhFzlfP5fPb1ztDRQJ3gokb3WOvZ2u6odeQbIyaNcZzNZrMzkY21AlQVIyMjCxul57xMJuHbUNVmP400AVUlFYVTzGck3GWtNETVo1gsDjdKq0ZVTVnlmv3IaD1ic6GBKo3w/v37hxJVZauUD0Dcij3Pk3nz5j0EzOwXHYWu4hKPjlZaRcenKi2soQd5xYoVv7HWQlUb0g01G4hIRIQLhcKLN910048BoL+/v2ZJSXXRbzj+xD1BGI0lnGCtImElIg7CyHV2dvwzr1u37kEiqjT7Krp+mlFVNcYogGeXLFmyH7EDZT2HpqgqHXPS8h3OZJ40maJaEjEaAmAoPKQEd7MVKWVWTNGWMuUBqgKPgUgwUm2ft52vv/76Jzo7Ox9GfG/TehlOIT4FEVFbW9uBRNDTpDUwMMBEJMYr/B+bKZCKgie5vs/u9p5yaU0w5klCo8PKbJVNZmTUtB3kKIqwePHi2zzPo1aYhlVVRYSy2WywYsWKzzbSs2/btk1VQe0LFtw+XvEPGi8Td2sICBFIG+6uZgVSXkuCwiR0humKmbIFyuWznzlj6dIyITZ281vf+tb79u3bty7xFW7m+TgiIrto0aJ/fOSRR65U1YZ8lSn17pbN93yq4Ol/GR/eHzGppYTVWWg2V0PMGcMawSDm8Baw84qdZjzE42etvegtAByXSiUiIrdu3br/kM/nRxOzYdO4dkwZdSIRsV1dXU9ee+21n1BVLpVKDZ/t6emR/v5+s6pryWdGK+7BfFuXdUpRYj082ll/1aA66jYBCXlZChyX27oWfCBW8PTGXJWlUolvueWWp1auXHl1Pp9nEanxDc9WpHNt3dlm55yzc+bMGV67du3l73//+wdfiv2diHTbtm1Kb35zUFgw708D2L3ZYoeNhCIlnuU+AAqFQInhYAQ2y5wtMGfy/3HFqrO2xBTJfZOM/BZAtH79+uufe+65G8vlco6IIiIymKUrDp2gSHeqaufPn//sWWed9YGvfOUrm3t6eszAwMBhLRrTofqxf9n0dgnLt2dZjvXLY1HizTMrl9Mc698ggDNe1sDLjVqbu/bNZ59/e0puDkwXHBtj5Oqrrz5306ZNt4+MjLwxiiIYY2qOeTM8A0znLJ96LWGon5ELpHZfkj6JKz3Z3kwi906Y3hWA5vN5E0URlixZ8ssbb7zxnevXr3/+5Qi3lomEnHTnkz+fv3///r/PW7rUr47BD3yJdyA0QfWYuFAnGU/539P+Pilkw0QRJ4b9JP+Ttm7139OyTnxHaraO649IWZxatpwptlOgtDfT2f2Hy1ac8dN64QIzC8sAcF/60pcWfOMb37jx4MGDPeVyeUEURRARGGMk7TnpMJnalOsOsnGdQCYYI15ilV5PPl5PYZx4J0gaVkAkZsllZixYsCBatGjRd6677rrrzjvvvFck3BQTATmUtj5y/zXOr37YkC7LWkLgjyMK/aTnQLVuOzaRfY0jKkyhOp68fUv4bFUBruOXTO9RhcTO+PH0Q0CsbYtbjjEMawzYZuFHrJl84Sft7R1/cewpb/1lGnOivkwzDr2lUon7+vqEiHDrrbce+73vfe89u3fvfl8URb9XqVTaiAhRFNXIwvP5vCMiVCoVAwCZTAae50WqiiiKbPJ/TFDNHBhjfAARAENEPsWqpzR0QKCqXhRFncxcNcaMiYg3Pj4+PxV+e3v7i0EQHOjo6PjhsmXLvn7HHXc89mqCcdRjSk/Kb/3X+9/u/MqVxujZUeAfAwUzp/T7gDiJmKkMog5oTVAVEERFs0QUEpNAlVThmKkKUKhQq4QAAgXUKOCx4SoRQZx0JgaCUQYkcm5JXHtE1tCgYRpU9jZn8/P/5ymnn/ULSij8p0ZcaSjgujRGovzIZrP4+Mc/fvIPfvCDRc45GR4ezlhrJQxDs2bNmkFrLW3atGkuAD3uuOP8VatWjVWrVfr1r3+dW7ZsWQUARIS6u7uDU089tdLV1eWGhobMmWeeWa1Wq/TMM894QRDQqlWr/K1bt3oPPPDAnMWLF1cuvfTS0UcffTTz2c9+9vhCoeAHQcA333zzb9etW7ePiFJ3HEoq9ogtfadW2M6dT84ffO6F4yLnKAhDa43Vqu9zIVcsz1+0cHzn8zvnEUeUyWRcJt8+bq0Rilw2CsPI5HMuihx35bIRZdqrne3tgW8Dm8nYoF2LMlapWD8MvUwnVwHgxef3dGUyGZ2z6A0jqiOy45e/OsZX1bZMljrnLBg89uST9xFRjT1ISyWmVxpKKOFZnq0LLdOIzf1IQFWpv7/fpAEuZhPSfL3UocGXJbRSqcRPPPEETeW7KJVKCgB9fX0ExJab5cuXKxDzNKf/Hw56e3u1t7d3Wr76+vootQgtX75cG0X6OlpQVUpYaichNlz0YmBgBU2+NjN6e3trZezt7dW66/Xf69cv9d9rz7cq5cbv8Dv8DvV42fOqqlI6hNYPMZNemuxdJx6p7esQR3trPLr09vYSeoFeTBuu0BsnoK+3L13EvpYgVUX99NGo/K8UU98901R1xIfnUqnE/f39R3Ux80pwuIuMV4Pk3QYzmBtfZxgAh1X2hiF00kVF/VYhiTLasfWprfPLlbKefdopw0BnGQABw3mgMwIwZq1NdKBxZM3IuSwAz7PeWBiFBKAdGDZApw5juJbJTnTK448/3jE8vLdw7rlv3zU8POxt2bZlgddW1JF9g9lsR4efZUTnvvXcZ+sZcvr7+01PT48cyZbd09Njkt9wRIR8Po/x8fG2L3/5ywtGR0e9iy66aHjFihVVAMEzzzzT3t3dLe3t7WOIT1KkDUIAZAAUAYwBCAF07NmzJ5O6SLW1tWF8fJyKxaJs3rw5t2nTpjlr1qw5cPHFF4/29vYe097eLlu3bs0tXLgwbGtrkxtuuGE3EQ0BNX28Qc0gPB0ztoD6zf7mRx9d8sLuHe8dHRl5L6DtbEyniJvH1qiojhBQEQgZcE6BSFTHawSgKgQiMWxyADwnMmaYSBXtqEVjnaTwUhC1qUgBwB4QWVJ0K6mqaJaYqgRyzslviu3Fh6zydy+7+LIfp66xqYLmFUl0er3o4OBgxxVXXHHh7t27/7RcLi/IZrNFY0x3GIaetXZEVX0RCYwxbYmb0HgQBAEzEzNDRJSIPGNMUUTGnHORtbbdGOPV+8CpKjGzqGrOOddJREPMPCYiSzQOvpkFECWxJF8sFou/WLp06fcvueSSH1x55ZV7k1fNqOSZJuCSlriP+kRVc/3/967/NF4e+zCgi5w6pHFuIxdBKVYrUnquJ9aRpmrFWG+anMpM3XKZCYRY+1V7ZgpEFSoKY+OG6SKpxdxNf8vzLCxbUEgg0OMZLztw9pvP/PTJJ5/sN9LoHA6Shp2G1/3A1q1b//OBAwfe5JyrlSFVG6Zatfo4x2nZp5UpCZVLdXXxUki1hFOfY2YYY0BEyOVyL3R1dd37vve978aPfexjLyAxGE16T/2XtAc8++yzuYe3PNwfZOSdo6OjUHVR3XhPSrGzCIM1FVIaLzcZmlUxXRddn3koIDOMqJr4r9bUhdBJVZZqrFShRok8z+N8Ng8V+cmyxcdddc455//mlQg51XNba/WCCy74mx07dtwQhiGci8uepmOyUaRWnkZCq28E9fc2eIbq0lODxNRnY9erWODGGINCobD7bW9721W333773YmcJvKW/pMK995/vXfe3t177/RdsH6kMh4REwMzk4kZeeUKrleyNJrcUhSIp2GBsORyOWuE92a9zIfff8n7v9PT32MGNh620SH1bMH69etv2bFjx7VBELhkhJp1Wqw6SOyhJDafz4dLly79zEMPPfSpMAwN4uE6dh0slUrc19unOw7s6Nz1210/rIi/fqQ6FhlmywpmJUz/MJT0FX9Sf8CX86Gp3+NWwspqq34l8iVcMFatfPOuH961ZmDjgDtMFSMBMJ7nydq1a/9+x44d14Zh6IwxPMuFm5o4rbVWKpWKfeGFF/569erV1xOR6+npYSCx765YsYKISR/6yUP/oJbOGq2OhTCwEAUpg9TM8EmOTJN7xR95FZ8k1no8N0EgrNaPqk5Z7dD48P/avn17+8aNGxtGHq0DE1H0jne84/oXXnjhz8IwDI0xjezesw7JsM3GGPV9P9q9e/ffXH311WcPDAy4np4eQ+l89fXvfuP6wAX/dbw8HinDxg5dQL2h+kjj1byVphjRa7Z4VVco5I0h+/Wr3vsnVzjnDuV+ZAC4K664YsPDDz98d7VaFY59gFLr1KvI4dHH1PkZsduSmTNnzq+vvfbat33oQx8a4o0bN7q7N9+9rBpUP1WulkVIDSnANcfvo6cwolfxmehg8ZWaQR1kyuWKE9HLv3/f9/+A6sKdz/DzUiqVOrZt23az7/uU+HdNaN1mOeoXaemii5nd2NjYm7797W9fS0Tx4mnfvv1XW2uKKk6alc+v1pITLwlR0T179/4lE2Hbtm0ztVIGoNu2bXvPgQMHlje7u3Bdg6QgCPT555//93ffffdcVlVi0KlBGKhy87NFpZt+3/fhVM/90QP3nJh6js5wO/m+/3vaaI/TRKgrAjMzfN9ffNttt72TBzHY5vvVU0SEqBnGpcMAM5GoiPVM+97B/SuBNJz7JIjneXrw4MGVyT73dcjp0QERSRRF2Llz53n803seXiMqS6IorFl9mh2prBxE89ncyqnpSW/Wz33uc8cODQ29RVuPwoJEBG1tbafy3hd3nWU8ayVRLL7eOTtSUADKID+qTmObTT1PvvjFL546Pj7ejdjvbLZZjF4NCACq1eoCNtbLSBpxs6UQG1iUtKHFbPHixW3OuZrPdqshiiLDcFFIlFK9MYwYUOPzWk2D1LHVMDcML/viiy+WW2xonoRMJlNmTd21MXV/2RpgYxtSGQKYZK1pFaSGGmb2mS17ifXm9c7XkUV6OA3ckCerq6srkwq2lQScwhjjM4NrNttWBJE2FHA+n6dW5coGACLyGYZHNQ7M2HolBECq4dRrqX81M48aY4AWm5fSzsrMIXueJ9RCgRnrQQCUTMPV4rHHHls7zPYaZus1g6oq5zNZk7rbtBI0CS+byWUa7m/nzZuXTYz6LbeYZmYUi8WAwZwRTY3orQMC4ETgItcwOKXv+9k695jXMHdHHxpTKc9lP/ALU4WrTW9ySNQcqoiCaBoheHq26uDBg/nEia6lBJw67Pm+H3EYhoXkuPqkEja7VpoSDkolbTgHj42NZZNzzlrH9dH0qPfw5MSHsfW2CbHvIUSQaXRL6gILtNY+OFXciIjHUFSJAGnc0JsSCk2CctjBRvf4vl/TcrVaAyciMPMBDvxglJib1ZHjkBBVhGGwqFH6c889VxN+K/XgFFEUdTMYphVD2lHSZAXSkBC8WCx6QOv1XiSKmyiK5rGIeBOXWg/W8MFGaZ7nZQG0pKpSVWGtHWEv440xtxQfdoLUiNBYcmEYHkxVla00RCdnXkBExIgQxocA6ytCwE1eYEkOa42Ojb1palqqi85kMkFyCrC1um/inTI4OHg8u8jlASRHAWPEjsHNLWBOuCZVnDc1LVV07N27NxuGIZi55RYhzIwwDDPcNbfrAJDS5bVQQyYAqvCMmUb8nPbgDRs2hLlcTpPTD691Do86rLUBV/0gC6QryebutZOQGFC8THa00S3bt2/nKIrAzNpiOwkVERQKhVHbKq6y05B6dFjTOPKZc2Hdod/XKGOvHTKZTJlJNQKo5cyFQHIu1HBDn6z29naXRJw5ojSIswGJuTTgKIry8ejc5MvmmRBTSUwL8Z5iz549XhAEYOaWcfoHJpzurLUVduo47sAtU74YibHhUP7syQFqtNj8W1PciAisChnV5OLrnbMjDAKgzs2bej3dJh04cIATpXxLabMoITEJw7CDW2lomoxkxjnE1KOqLCKx71IL2YOBmr+3MCAt13NTxEZ/NDzZkM1mW3L/i2SbZK2tMpSmaXpaBfGpdxQbpbe3t+eAQ9MgNSuYGUEQFNgYYzE5DkZrII1/4FxDAc+dOzdzuMRkTYaUsCPPBDi0mhYLiHWvTMh42aca3TI4OBgdgpSsaaExUCgUnmeyZqwFD0ADAEMp7JrX8eNGNzjnDmYymZQr8rXM21GFqlI2m8XixYu/zwsXLv5lFIYKnbphbGp5i5fJkIvcjref+fZfAMDGno21zW4aguDmm29+NpPJ7BcRrhGoNj8U8U4pWLly5X18StsbH7Jqd2U4o0QkmlBK0czshbMKMUlbnE8hhZBAY5YdtZxRi8xuIqqWSiWuJxBPGGl5w4YNO7PZ7JYkBG3Tj9E1KikiZDKZg0uXLt3FJ51x0nDOy/1TNpsjcaKSOL1rk6hmtebSHfOi1lhZyVBbrm0bMCMBCwCQcw4nnnji11ootG4tKlxbW9vzH/zgB4cYAOZ0Lfxi6EeBMZagqkICmd2xKQEA8WgjNe5LAkACscayRtELJ578hj4A1NPTM1NhBABfeeWVdxWLxe0ikhKANzWcc8hkMnTOOef8BRFVuVQq8UXr1z/V2dbxd/lcnkniUNLNoN8SQq0hEhEIqkyQQq5AbflC3xmnnDHY39/PDSxFCoDe9a53lU877bTrCoWCpMdYXsMiHFGoasTMvHjx4n+89dZbNwNgUlXauHEj9/f346sD//unjt0548F4SASPZ7GrkkIBnlCsswIqCDuKnR4Ut1156RUfPUzeaAPAnXfeeV/47W9/e41zLmDmTLMM2XVbvEhE7Pz587fceuuta9esWTNeKpVqQSOZiOTBn//8lF898/iDYnTu2PiYM4ZnNbWfiwMJAk6UQdJR7DAkfNfll/7xHyGmRjqcCCUEgPft21e44IIL7t2/f//ZzjlnrZ31evqUbFxEnKqa+fPnP3PNNdesv+qqq55J+b9j9k0iKWmJzz3jjCfb8oULM2wf7Ci2m/gd6jBLhy0GqUbOEREKuaJhmJsvv/SPL6M4hsPhhp/RUqmk3d3do2vXrr1k6dKl/dls1jjnCDE9/qwsOwAws0RRFBljTHd39/+77LLL/qBeuMCUzW7ak1XV3vn9b/zdaLn8l8YaVKpVqIojYigkjnk6mca2Rr8fv7SuYmkiFbUBI6ZcS/zikvfU3Za8hGrZistDTJpE+IxZZMiaXD4HFkJXR2fvpRe8pw94xcE5CIAaY/Dud7/7qm3btn2mUqnMSeImCDPHDMvTqfnT7FDddZ1yzyRzZJI+SX1I9S9KKzXxb9YJav/0Nk1D+ubzeZx00knfvfvuu68kouGp4XWnDUH181b/D+9aU61UPl6pVi60OS8fiUMYhRAoiGIeqvQkvSog4uqCchA4MTpzepQzGVImwi0nB0wINaM7E8fBy9PvzIAqosjVGoWxFoYspKrl9va2e9tyhVsvXn/xfaVSiV9N4KikAgmA/NVf/dUbN2/e/Il9+/b9YRAE88NwGtXHpMAZU79PEeike+qvpfemdZOcCqyVvZ4FKH2WmeF5HubPn//wkiVL7rzrrrv+OxGFMzXsRnMMlUolSm9+4OEHVj6z8zcXWWNOD8LodDIUKdQkv26s5z0HkLooPF4Bx8yjTLyP4xMDHUo6RCDVmCd03ImUVSRUkCWgAgiIOc9gcuLGiZBjtt0AXCTRHlbKgWgVE40r1IjK42E12nXC0jd89x1r3/FInXCO1HBqADhjDD7/+c+/YWBg4F3VavUMETlLRDxjjEvIW9kYc8DzvH2+779RRNhaW/U8b58xJgrDsMMYU6U4DK4BEIjImIj4xhgvCIKyqqq11mPmfBiGI9ZaQ0TdRJRxzu0WkUBETgegzGyMMU8PDw/vXL58+aZvfvOb/0wJ2Xmj8v9/m3fma5wWT2UAAAAASUVORK5CYII=";

// 🔧 Below this many ms remaining, the countdown badge turns red (matches
// the mockup: 4h remaining was red, 16h/23h/33h/69h were not). Adjust this
// single constant if you want the "expiring soon" warning to kick in
// earlier or later.
const URGENT_THRESHOLD_MS = 6 * 3_600_000; // 6h

// 🔧 Combined h+m label, no seconds (seconds would just cause a re-render
// every second for no real benefit at this granularity). Returns null once
// truly expired — callers use that to filter/purge rather than display
// "Expired" at all, since expired items shouldn't be shown.
function formatCountdown(expiresAt: string, now: number): { label: string; urgent: boolean } | null {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const label = h >= 1 ? `${h}h ${m}m` : `${m}m`;
  return { label: `Expires in ${label}`, urgent: diff < URGENT_THRESHOLD_MS };
}

/** Small, self-contained confirmation modal — no external dialog library
 * dependency, so it doesn't assume a component that may not be set up
 * elsewhere in this project. */
function ConfirmDeleteModal({
  onConfirm,
  onCancel,
  isDeleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>

        <h2 className="mt-4 text-base font-semibold text-gray-900">Delete this design?</h2>
        <p className="mt-1 text-sm text-gray-500">
          This can't be undone — the image will be permanently removed.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Loads a bundled image asset as an <img> — same-origin, so it never
 * taints a canvas regardless of any remote CORS config. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load watermark logo"));
    img.src = src;
  });
}

/** Recolors an icon to one flat translucent color while keeping its
 * original alpha shape (via source-in compositing) — turns the
 * four-color PlacdAI mark into a plain whitish-gray silhouette for the
 * watermark. Drawn at 3x the target size and scaled down on the main
 * canvas so the small squares stay crisp instead of aliasing. */
function tintIcon(img: HTMLImageElement, size: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0, size, size);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = color;
  cx.fillRect(0, 0, size, size);
  return c;
}

// 🔧 Watermark is applied client-side at download time — not baked in when
// the design is generated — so the gallery preview and the in-app canvas
// stay clean, and this is the one place it needs to happen no matter which
// button triggers it. Draws onto a canvas rather than re-uploading through
// the server: the fetched blob is loaded via an object URL (same-origin,
// so the canvas never taints regardless of the storage bucket's CORS
// headers) and the export happens entirely in the browser.
//
// Style is deliberately Gemini-esque: no solid badge behind it, just
// translucent whitish-gray text + a matching translucent logo mark, with
// a soft shadow doing the legibility work instead of a background pill —
// present without stamping a chunky badge over the photo.
async function watermarkBlob(sourceBlob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(sourceBlob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0);

  // Scales with the actual export size so it reads the same on a small
  // preview and a full-resolution original.
  const pad = Math.round(canvas.width * 0.022);
  const fontSize = Math.max(15, Math.round(canvas.width * 0.024));
  const fontSpec = `600 ${fontSize}px 'Manrope', sans-serif`;
  try {
    await document.fonts.load(fontSpec);
  } catch {
    // Falls back to the browser default sans-serif — still legible,
    // just not pixel-matched to the in-app wordmark.
  }

  const markColor = "rgba(255, 255, 255, 0.78)";
  ctx.font = fontSpec;
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = fontSize * 0.35;
  ctx.shadowOffsetY = fontSize * 0.04;

  const text = "PlacdAI";
  const textWidth = ctx.measureText(text).width;
  const iconSize = fontSize * 1.15;
  const gap = fontSize * 0.4;
  const rowHeight = Math.max(fontSize, iconSize);

  const groupWidth = iconSize + gap + textWidth;
  const rowTop = canvas.height - pad - rowHeight;
  const iconX = canvas.width - pad - groupWidth;
  const iconY = rowTop + (rowHeight - iconSize) / 2;
  const textX = iconX + iconSize + gap;
  const textY = rowTop + rowHeight / 2;

  try {
    const logoImg = await loadImage(WATERMARK_LOGO);
    const tinted = tintIcon(logoImg, Math.round(iconSize * 3), markColor);
    ctx.drawImage(tinted, iconX, iconY, iconSize, iconSize);
  } catch (e) {
    // Text-only watermark still applied even if the logo asset fails to
    // load for some reason — better than no mark at all.
    console.error("Watermark logo failed to load, using text only", e);
  }

  ctx.fillStyle = markColor;
  ctx.fillText(text, textX, textY);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  return new Promise((resolve, reject) => {
    canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("Watermark export failed"))), "image/png");
  });
}

function Card({
  item,
  now,
  onDelete,
}: {
  item: Item;
  now: number;
  onDelete: (id: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const countdown = formatCountdown(item.expires_at, now);

  const download = async () => {
    const r = await fetch(item.public_url);
    const b = await r.blob();
    // Never let a watermarking failure (e.g. an older browser without
    // createImageBitmap) block the download itself — worst case the
    // user gets the un-watermarked image rather than nothing.
    const out = await watermarkBlob(b).catch((e) => {
      console.error("Watermark failed, downloading original", e);
      return b;
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = `placdai-${item.id}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await apiFetch("/api/delete-generation", {
        method: "DELETE",
        body: JSON.stringify({ id: item.id, storage_path: item.storage_path }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      onDelete(item.id); // Remove from UI
    } catch (e) {
      console.error(e);
      alert("Could not delete the image.");
      setIsDeleting(false);
      setConfirming(false);
    }
  };

  // Expired items are purged by the parent (see Gallery's auto-purge
  // effect) before they'd ever reach here — this is just a defensive
  // fallback in case a render slips in between expiry and purge.
  if (!countdown) return null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <img
        src={item.public_url}
        alt={item.style ?? "Generated room"}
        className="h-56 w-full object-cover"
      />
      <span
        className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${
          countdown.urgent ? "bg-red-600" : "bg-black/70"
        }`}
      >
        {countdown.label}
      </span>

      {/* Action Buttons Group */}
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {/* Hover-reveal: hidden by default, fades in on card hover (relies
            on the `group` class on the card's wrapping div). */}
        <button
          onClick={() => setConfirming(true)}
          disabled={isDeleting}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md opacity-0 transition-opacity duration-200 hover:bg-white group-hover:opacity-100 disabled:opacity-50"
          title="Delete image"
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={download}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
        >
          <Download className="h-3 w-3" /> Download
        </button>
      </div>

      {(item.style || (item.products && item.products.length > 0)) && (
        <div className="border-t border-border/60 px-3 py-2.5">
          {item.style && <p className="text-xs text-muted-foreground">{item.style}</p>}

          {item.products && item.products.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Buyable products ({item.products.length})
              </p>
              {item.products.map((p, i) => (
                <a
                  key={p.id}
                  href={p.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 transition hover:border-primary/40"
                >
                  <span className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "https://placehold.co/72x72?text=%20";
                      }}
                    />
                    <span className="absolute left-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-br-md bg-primary text-[9px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium">{p.name}</span>
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      {typeof p.price === "number" ? currency.format(p.price) : null}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {confirming && (
        <ConfirmDeleteModal
          isDeleting={isDeleting}
          onCancel={() => setConfirming(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function Gallery() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[] | null>(null);

  // 🔧 One shared clock for the whole page instead of each card running
  // its own interval — also what lets the auto-purge effect below and
  // each card's countdown/urgency color stay in sync with each other.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/list-generations")
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch(() => setItems([]));
  }, [user]);

  // Removes the item from the state without needing to re-fetch the whole list
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev?.filter((item) => item.id !== id) ?? null);
  };

  // 🔧 Auto-purge: as soon as an item's expires_at is in the past, drop it
  // from the gallery AND fire the same delete call the trash button uses,
  // so it's actually removed (storage + DB row), not just hidden from
  // view. Runs whenever the shared clock ticks or the item list changes.
  // Best-effort on the delete call — an item that's expired shouldn't
  // reappear even if this particular cleanup request fails; a later tick,
  // or the same check next time the gallery loads, will catch it again
  // since it's still gone from `items` either way.
  useEffect(() => {
    if (!items || items.length === 0) return;
    const expired = items.filter((i) => new Date(i.expires_at).getTime() <= now);
    if (expired.length === 0) return;

    setItems((prev) => prev?.filter((i) => new Date(i.expires_at).getTime() > now) ?? null);

    for (const item of expired) {
      apiFetch("/api/delete-generation", {
        method: "DELETE",
        body: JSON.stringify({ id: item.id, storage_path: item.storage_path }),
      }).catch((e) => console.error("Auto-purge delete failed for", item.id, e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now]);

  // Newest first. Sorted here (not trusted from the API) so this holds
  // regardless of what order /api/list-generations happens to return.
  const sortedItems = useMemo(
    () =>
      items
        ? [...items].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        : null,
    [items],
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Your gallery</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saved rooms are kept for 72 hours (max 20). Download to keep them.
        </p>
        {sortedItems === null ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            No generations yet — head back home and create one.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedItems.map((i) => (
              <Card key={i.id} item={i} now={now} onDelete={handleRemoveItem} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}