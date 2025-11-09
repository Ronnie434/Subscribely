import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { setOnboardingComplete } from '../utils/storage';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'calendar-outline',
    title: 'Track your subscriptions effortlessly',
    subtitle: 'Never forget a renewal',
  },
  {
    id: '2',
    icon: 'bar-chart-outline',
    title: 'Know where your money goes',
    subtitle: 'See all your subscriptions in one place',
  },
  {
    id: '3',
    icon: 'wallet-outline',
    title: 'Stay in control',
    subtitle: 'Easily manage your subscriptions and get reminders',
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
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

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View style={styles.content}>
        <Ionicons name={item.icon} size={120} color={theme.colors.primary} />
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
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
        <TouchableOpacity
          style={styles.button}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
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
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 100,
    paddingBottom: 60,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: theme.colors.primary,
    width: 24,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});