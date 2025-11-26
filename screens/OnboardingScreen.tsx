import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { setOnboardingComplete } from '../utils/storage';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  lottieSource?: any; // Lottie JSON animation file
  title: string;
  subtitle: string;
}

// To add Lottie animations, import your Lottie JSON files and add them to the slides:
// Example: import calendarAnimation from '../assets/lottie/calendar.json';
// Then add: lottieSource: calendarAnimation to the slide object
const slides: OnboardingSlide[] = [
  // {
  //   id: '1',
  //   icon: 'shield-checkmark-outline',
  //   // lottieSource: require('../assets/lottie/calendar.json'), // Uncomment and add your Lottie file
  //   title: 'Never get blindsided by any charge again',
  //   subtitle: 'Track every subscription, bill, and renewal in one place',
  // },
  // {
  //   id: '2',
  //   icon: 'bar-chart-outline',
  //   // lottieSource: require('../assets/lottie/chart.json'), // Uncomment and add your Lottie file
  //   title: 'See every charge before it happens',
  //   subtitle: 'Get full visibility into upcoming renewals and billing dates',
  // },
  // {
  //   id: '3',
  //   icon: 'notifications-outline',
  //   // lottieSource: require('../assets/lottie/wallet.json'), // Uncomment and add your Lottie file
  //   title: 'Stay ahead of every charge',
  //   subtitle: "Get timely reminders so you're never caught off guard",
  // },
  {
    id: '1',
    icon: 'shield-checkmark-outline',
    title: 'Take control of your charges',
    subtitle: 'Track subscriptions, bills, and renewals in one place',
  },
  {
    id: '2',
    icon: 'bar-chart-outline',
    title: 'Plan ahead for upcoming payments',
    subtitle: 'Get visibility into renewals and billing dates you track',
  },
  {
    id: '3',
    icon: 'notifications-outline',
    title: 'Stay ahead of your payments',
    subtitle: "Get timely reminders so you're never caught off guard",
  }
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleGetStarted = async () => {
    await setOnboardingComplete();
    onComplete();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
      flex: 1,
    },
    slide: {
      width,
      flex: 1,
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingBottom: 60,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      paddingTop: 40,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      lineHeight: 40,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.background === '#000000'
        ? 'rgba(255,255,255,0.65)'
        : '#6B7280',
      textAlign: 'center',
      lineHeight: 22,
    },
    footer: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.md,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.border,
      marginHorizontal: 5,
    },
    activeDot: {
      backgroundColor: theme.colors.primary,
      width: 24,
    },
    button: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 26,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });

  const AnimatedSlide = ({ item, isActive, isLastSlide }: { item: OnboardingSlide; isActive: boolean; isLastSlide: boolean }) => {
    const iconScale = useRef(new Animated.Value(0)).current;
    const iconOpacity = useRef(new Animated.Value(0)).current;
    const iconRotate = useRef(new Animated.Value(0)).current;
    const textTranslateY = useRef(new Animated.Value(12)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const buttonOpacity = useRef(new Animated.Value(0)).current;
    const lottieRef = useRef<LottieView>(null);

    useEffect(() => {
      if (isActive) {
        // Reset animations
        iconScale.setValue(0);
        iconOpacity.setValue(0);
        iconRotate.setValue(0);
        textTranslateY.setValue(12);
        textOpacity.setValue(0);
        buttonOpacity.setValue(0);

        // Play Lottie animation if available
        if (item.lottieSource && lottieRef.current) {
          lottieRef.current.play();
        }

        // Icon animation: fade-in + scale + subtle rotation
        const rotationValue = item.id === '1' ? -5 : item.id === '3' ? 5 : 0; // Shield rotates left, Bell rotates right
        
        Animated.parallel([
          Animated.timing(iconOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(iconScale, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(iconRotate, {
              toValue: rotationValue,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(iconRotate, {
              toValue: 0,
              tension: 50,
              friction: 8,
              useNativeDriver: true,
            }),
          ]),
        ]).start();

        // Text animation: slide up + fade-in
        Animated.parallel([
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 300,
            delay: 100,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 300,
            delay: 100,
            useNativeDriver: true,
          }),
        ]).start();

        // Button animation: fade-in
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 300,
          delay: 200,
          useNativeDriver: true,
        }).start();
      } else {
        // Reset Lottie animation when slide is not active
        if (lottieRef.current) {
          lottieRef.current.reset();
        }
      }
    }, [isActive, item.lottieSource]);

    // Theme-aware spot illustration colors
    const getSpotColor = () => {
      const isDark = theme.colors.background === '#000000';
      switch (item.id) {
        case '1': // Shield - Primary blue tint
          return isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)';
        case '2': // Bar Chart - Green tint
          return isDark ? 'rgba(52, 199, 89, 0.15)' : 'rgba(52, 199, 89, 0.1)';
        case '3': // Notifications - Purple tint
          return isDark ? 'rgba(94, 92, 230, 0.15)' : 'rgba(88, 86, 214, 0.1)';
        default:
          return isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)';
      }
    };

    // Vary icon sizes slightly for visual interest
    const getIconSize = () => {
      switch (item.id) {
        case '1':
          return 115;
        case '2':
          return 110;
        case '3':
          return 115;
        default:
          return 115;
      }
    };

    const spotColor = getSpotColor();
    const iconSize = getIconSize();
    const spotSize = 170;

    return (
      <View style={styles.slide}>
        <View style={styles.content}>
          <Animated.View
            style={{
              opacity: iconOpacity,
              transform: [
                { scale: iconScale },
                { rotate: iconRotate.interpolate({
                  inputRange: [-10, 10],
                  outputRange: ['-10deg', '10deg'],
                }) },
              ],
              width: spotSize,
              height: spotSize,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* Colored circular background spot */}
            <View
              style={{
                position: 'absolute',
                width: spotSize,
                height: spotSize,
                borderRadius: spotSize / 2,
                backgroundColor: spotColor,
              }}
            />
            {/* Icon */}
            {item.lottieSource ? (
              <LottieView
                ref={lottieRef}
                source={item.lottieSource}
                autoPlay={false}
                loop={true}
                style={{ width: iconSize, height: iconSize }}
              />
            ) : (
              <Ionicons name={item.icon} size={iconSize} color={theme.colors.primary} />
            )}
          </Animated.View>
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            }}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </Animated.View>
        </View>
        <View style={styles.footer}>
          <View style={styles.paginationContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.activeDot,
                ]}
              />
            ))}
          </View>
          {isLastSlide && (
            <Animated.View style={{ opacity: buttonOpacity }}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleGetStarted}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    );
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <AnimatedSlide item={item} isActive={index === currentIndex} isLastSlide={index === slides.length - 1} />
  );

  // Determine gradient colors based on theme
  const gradientColors: [string, string] = theme.colors.background === '#000000' 
    ? ['#0A0A0A', '#000000'] 
    : [theme.colors.background, theme.colors.background];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          bounces={false}
        />
      </View>
    </LinearGradient>
  );
}