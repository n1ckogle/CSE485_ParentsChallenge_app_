import { Stack } from "expo-router";
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { db } from '../../firebaseConfig';

const NON_PROFIT_ANALYSIS_2021_URL =
  "https://parentschallenge.org/wp-content/uploads/2021/03/Parents-Challenge-2021-Analytics.pdf";
const NON_PROFIT_ANALYSIS_2022_URL =
  "https://parentschallenge.org/wp-content/uploads/2023/05/Parents-Challenge-2022-Annual-Report-1.pdf";
const APPLICATION_URL = "https://parentschallenge.org/apply/financial-aid/";

const HERO_BANNER = require("../../assets/programs/program-banner.jpg");
const TRANSPARENCY_BADGE = require("../../assets/programs/excellence-in-giving-transparent.png");

const PARENTAL_EMPOWERMENT_ICON = require("../../assets/programs/parental-empowerment-icon.jpg");
const SCHOLARSHIPS_GRANTS_ICON = require("../../assets/programs/scholarships-grants-icon.jpg");
const STUDENT_SERVICES_ICON = require("../../assets/programs/student-services-icon.jpg");
const COMMUNITY_ENGAGEMENT_ICON = require("../../assets/programs/community-engagement-icon.jpg");

const ANKRUM_FAMILY_IMAGE = require("../../assets/programs/ankrum-family.jpg");
const STANDARDS_OF_EXCELLENCE_IMAGE = require("../../assets/programs/standards-of-excellence.png");


const activityCards = [
  {
    id: "parental-empowerment",
    title: "PARENTAL EMPOWERMENT",
    image: PARENTAL_EMPOWERMENT_ICON,
    description:
      "We conduct 30 to 40 parent sessions (held virtual and in-person during the evening) If in-person a child-care stipend and free dinner are provided.  Parents are taught how to become more self-sufficient while also becoming better education consumers and advocates.",
  },
  {
    id: "scholarships-grants",
    title: "SCHOLARSHIPS + GRANTS",
    image: SCHOLARSHIPS_GRANTS_ICON,
    description:
      "We provide financial support to low-income parents that can be used in private, traditional public, charter public or home school.",
  },
  {
    id: "student-services",
    title: "STUDENT SERVICES",
    image: STUDENT_SERVICES_ICON,
    description:
      "We recommend resources to families can be used to improve academic and cognitive skills as well as development of coping and life skills.",
  },
  {
    id: "community-engagement",
    title: "COMMUNITY ENGAGEMENT",
    image: COMMUNITY_ENGAGEMENT_ICON,
    description:
      "We reach out and collaborate with other service-providing organizations throughout the country and community to take maximum advantage of other resources while minimizing duplication, overlap, and inefficiencies.",
  },
];


const choiceCards = [
  {
    title: "Private School Scholarships",
    description:
      "Scholarships up to $2500 per year for partial tuition expenses may be awarded to eligible families. Parents can also request funds for technology in the home, school fees, and summer programs.",
  },
  {
    title: "Traditional Public School and Charter Public School Grants",
    description:
      "Grants up to $1200 per year for academic enhancement programs such as tutoring, online programs, computers, academic software, required uniforms, transportation, activity fees, and other approved uses. Grants can also be used for summer school programs.",
  },
  {
    title: "Home School Grants",
    description:
      "Grants up to $1200 per year for curricular materials, extracurricular activities, technology, or other expenses approved by Parents Challenge staff.",
  },
];

function SectionTitle({ leftLine = true, rightLine = true, prefix, accent }) {
  return (
    <View style={styles.sectionTitleRow}>
      {leftLine ? (
        <View style={styles.sectionLine} />
      ) : (
        <View style={styles.sectionLineSpacer} />
      )}
      <Text style={styles.sectionTitleText}>
        <Text style={styles.sectionTitlePrefix}>{prefix} </Text>
        <Text style={styles.sectionTitleAccent}>{accent}</Text>
      </Text>
      {rightLine ? (
        <View style={styles.sectionLine} />
      ) : (
        <View style={styles.sectionLineSpacer} />
      )}
    </View>
  );
}

function LinkButton({ label, onPress, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkButton,
        secondary && styles.linkButtonSecondary,
        pressed && styles.linkButtonPressed,
      ]}
    >
      <Text
        style={[
          styles.linkButtonText,
          secondary && styles.linkButtonTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActivityCard({ item, fullWidth }) {
  return (
    <View
      style={[
        styles.activityCard,
        fullWidth ? styles.activityCardFull : styles.activityCardHalf,
      ]}
    >
      <Image
        source={item.image}
        style={styles.activityIcon}
        resizeMode="contain"
      />
      <Text style={styles.activityTitle}>{item.title}</Text>
      <Text style={styles.activityText}>{item.description}</Text>
    </View>
  );
}

function ChoiceCard({ title, description }) {
  return (
    <View style={styles.choiceCard}>
      <Text style={styles.choiceTitle}>• {title}</Text>
      <Text style={styles.choiceText}>{description}</Text>
    </View>
  );
}

export default function ProgramsPage() {
  const { width } = useWindowDimensions();

  const [dynamicCriteria, setDynamicCriteria] = useState([]);
  const [additionalNote, setAdditionalNote] = useState("");
  const [loading, setLoading] = useState(true);

  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;

  const contentWidth = Math.min(width - 24, 1200);

  const heroHeight = isLargeTablet ? 360 : isTablet ? 280 : 220;
  const badgeSize = isTablet ? 170 : 145;
  const familyImageHeight = isLargeTablet ? 420 : isTablet ? 340 : 240;
  const standardsImageHeight = isLargeTablet ? 760 : isTablet ? 580 : 360;

  useEffect(() => {
    const fetchIncomeData = async () => {
      try {
        const docRef = doc(db, "settings", "incomeCriteria");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          const criteriaList = [
            `2 people: ${data['2people']}`,
            `3 people: ${data['3people']}`,
            `4 people: ${data['4people']}`,
            `5 people: ${data['5people']}`,
            `6 people: ${data['6people']}`,
          ];
          
          setDynamicCriteria(criteriaList);
          setAdditionalNote(`Note: Add ${data.additionalPerson} for each additional person.`);
        }
      } catch (error) {
        console.error("Error fetching income criteria:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIncomeData();
  }, []);

  return (
    <>
      {/* Set the title to empty to remove the "Programs" text while preserving the back button */}
      <Stack.Screen options={{ title: "" }} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageContainer, { width: contentWidth }]}>
          <Image
            source={HERO_BANNER}
            style={[styles.heroImage, { height: heroHeight }]}
            resizeMode="cover"
          />

          <View style={styles.introFrame}>
            <SectionTitle prefix="OUR" accent="Programs" />

            <Text style={styles.programDescription}>
              The Parents Challenge Fact Sheet. We empower parents with the
              tools and resources to choose the best education for their K-12
              children.
            </Text>
          </View>

          <View style={styles.bannerSection}>
            <Text style={styles.bannerSectionText}>
              THE PARENTS CHALLENGE PROGRAM IS BUILT UPON FOUR KEY SERVICES:
            </Text>
          </View>

          <View style={styles.activitiesGrid}>
            {activityCards.map((item) => (
              <ActivityCard key={item.id} item={item} fullWidth={!isTablet} />
            ))}
          </View>

          <View style={styles.financialAidSection}>
            <Text style={styles.majorSectionHeading}>
              FINANCIAL AID + PROGRAM CHOICES
            </Text>

            <View
              style={[
                styles.financialAidTopRow,
                { flexDirection: isTablet ? "row" : "column" },
              ]}
            >
              <View
                style={[
                  styles.infoCard,
                  styles.criteriaCard,
                  isTablet && styles.halfCard,
                ]}
              >
                <Text style={styles.infoCardTitle}>Sample Income Criteria</Text>

                {dynamicCriteria.map((line) => (
                  <Text key={line} style={styles.criteriaLine}>
                    • {line}
                  </Text>
                ))}

                <Text style={styles.criteriaNote}>
                  {additionalNote}
                </Text>
                
                <Text style={styles.infoParagraph}>
                  Parents can qualify for financial aid if they meet the income
                  criteria.
                </Text>

                <Text style={styles.infoParagraph}>
                  Financial aid is based on need, and families must meet federal
                  income eligibility criteria for Free and Reduced Lunch.
                </Text>
              </View>

              <View style={[styles.infoCard, isTablet && styles.halfCard]}>
                <Text style={styles.infoCardTitle}>
                  Parents can select one of three “Choices”
                </Text>

                {choiceCards.map((choice) => (
                  <ChoiceCard
                    key={choice.title}
                    title={choice.title}
                    description={choice.description}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const COLORS = {
  background: "#F4F5F2",
  card: "#F7F8F5",
  navy: "#34415D",
  mutedNavy: "#5C6780",
  sage: "#DDE4DE",
  border: "#C9D4CC",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingVertical: 12,
    paddingBottom: 32,
    alignItems: "center",
  },
  pageContainer: {
    alignSelf: "center",
  },
  heroImage: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  },

  introFrame: {
    borderWidth: 3,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 26,
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  sectionLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.border,
  },
  sectionLineSpacer: {
    flex: 1,
  },
  sectionTitleText: {
    marginHorizontal: 14,
    textAlign: "center",
  },
  sectionTitlePrefix: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
    color: COLORS.navy,
  },
  sectionTitleAccent: {
    fontSize: 28,
    fontStyle: "italic",
    color: COLORS.navy,
  },
  programDescription: {
    color: COLORS.navy,
    fontSize: 17,
    lineHeight: 31,
    textAlign: "center",
    marginBottom: 22,
  },
  badgeImage: {
    alignSelf: "center",
    marginBottom: 18,
  },
  analysisButtons: {
    alignItems: "center",
  },

  linkButton: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 3,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  linkButtonSecondary: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  linkButtonPressed: {
    opacity: 0.85,
  },
  linkButtonText: {
    textAlign: "center",
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  linkButtonTextSecondary: {
    color: COLORS.white,
  },

  bannerSection: {
    backgroundColor: COLORS.sage,
    paddingVertical: 24,
    paddingHorizontal: 18,
    marginBottom: 18,
    borderRadius: 8,
  },
  bannerSectionText: {
    textAlign: "center",
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 30,
    letterSpacing: 1.1,
  },

  activitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  activityCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 22,
    marginBottom: 16,
  },
  activityCardFull: {
    width: "100%",
  },
  activityCardHalf: {
    width: "48.5%",
  },
  activityIcon: {
    width: 86,
    height: 86,
    alignSelf: "center",
    marginBottom: 16,
  },
  activityTitle: {
    color: COLORS.navy,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 14,
  },
  activityText: {
    color: COLORS.navy,
    fontSize: 16,
    lineHeight: 30,
  },

  financialAidSection: {
    marginBottom: 24,
  },
  majorSectionHeading: {
    color: COLORS.navy,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 18,
  },
  financialAidTopRow: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  halfCard: {
    width: "48.5%",
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginBottom: 14,
  },
  criteriaCard: {
    marginRight: 0,
  },
  infoCardTitle: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "center",
  },
  criteriaLine: {
    color: COLORS.navy,
    fontSize: 16,
    lineHeight: 28,
  },
  criteriaNote: {
    color: COLORS.mutedNavy,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 10,
    fontStyle: "italic",
  },
  infoParagraph: {
    color: COLORS.navy,
    fontSize: 16,
    lineHeight: 28,
    marginTop: 6,
  },

  choiceCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  choiceTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 8,
  },
  choiceText: {
    color: COLORS.navy,
    fontSize: 15,
    lineHeight: 26,
  },

  applicationCard: {
    backgroundColor: COLORS.sage,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
  },
  applicationText: {
    color: COLORS.navy,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 28,
    marginBottom: 14,
  },

  testimonialSection: {
    backgroundColor: COLORS.sage,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: "space-between",
    marginBottom: 24,
  },
  familyImage: {
    borderRadius: 8,
    marginBottom: 16,
  },
  testimonialTextContainer: {
    justifyContent: "center",
  },
  testimonialHeading: {
    color: COLORS.navy,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 18,
  },
  testimonialText: {
    color: COLORS.navy,
    fontSize: 16,
    lineHeight: 31,
    marginBottom: 16,
  },

  standardsSection: {
    marginBottom: 10,
  },
  standardsImage: {
    width: "100%",
  },
});