import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import {
  getDaysInMonth,
  getMonthStartOffset,
  formatDateToISO,
  isSameDay,
  calculateFutureRenewals,
} from '../utils/calendarHelpers';
import { RepeatInterval } from '../types';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface CalendarViewProps {
  renewalDate: string; // ISO date string (YYYY-MM-DD)
  repeatInterval: RepeatInterval;
  subscriptionColor?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({
  renewalDate,
  repeatInterval,
  subscriptionColor,
}: CalendarViewProps) {
  const { theme } = useTheme();
  const today = new Date();
  
  // Start with the current month
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Calculate all renewal dates for the next 12 months
  const renewalDates = useMemo(() => {
    return calculateFutureRenewals(renewalDate, repeatInterval, 12);
  }, [renewalDate, repeatInterval]);

  // Get days in the current month
  const daysInMonth = useMemo(() => {
    return getDaysInMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Get offset for the first day of the month
  const monthStartOffset = useMemo(() => {
    return getMonthStartOffset(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Navigation handlers
  const goToPreviousMonth = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Check if a date has a renewal
  const hasRenewal = (date: Date): boolean => {
    const dateStr = formatDateToISO(date);
    return renewalDates.includes(dateStr);
  };

  // Check if a date is today
  const isToday = (date: Date): boolean => {
    return isSameDay(date, today);
  };

  const dotColor = subscriptionColor || theme.colors.primary;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    monthYearText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    navButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    navButtonPressed: {
      opacity: 0.6,
    },
    todayButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    todayButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    calendarContainer: {
      flex: 1,
      padding: 16,
    },
    weekDaysRow: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    weekDayText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayContent: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    todayCell: {
      backgroundColor: theme.isDark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    dayText: {
      fontSize: 16,
      fontWeight: '400',
      color: theme.colors.text,
    },
    todayText: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    dot: {
      position: 'absolute',
      bottom: 4,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: dotColor,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      gap: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    todayIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header with navigation */}
      <View style={styles.header}>
        <View style={styles.navButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.navButton,
              pressed && styles.navButtonPressed,
            ]}
            onPress={goToPreviousMonth}>
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.navButton,
              pressed && styles.navButtonPressed,
            ]}
            onPress={goToNextMonth}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        <Text style={styles.monthYearText}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.todayButton,
            pressed && styles.navButtonPressed,
          ]}
          onPress={goToToday}>
          <Text style={styles.todayButtonText}>Today</Text>
        </Pressable>
      </View>

      {/* Calendar */}
      <ScrollView style={styles.calendarContainer} showsVerticalScrollIndicator={false}>
        {/* Week day headers */}
        <View style={styles.weekDaysRow}>
          {DAY_NAMES.map((day) => (
            <View key={day} style={styles.weekDay}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calendarGrid}>
          {/* Empty cells for offset */}
          {Array.from({ length: monthStartOffset }).map((_, index) => (
            <View key={`empty-${index}`} style={styles.dayCell} />
          ))}

          {/* Days of the month */}
          {daysInMonth.map((date) => {
            const isCurrentDay = isToday(date);
            const hasRenewalDate = hasRenewal(date);

            return (
              <View key={date.toISOString()} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayContent,
                    isCurrentDay && styles.todayCell,
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      isCurrentDay && styles.todayText,
                    ]}>
                    {date.getDate()}
                  </Text>
                  {hasRenewalDate && <View style={styles.dot} />}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: dotColor }]} />
          <Text style={styles.legendText}>Renewal Date</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.todayIndicator} />
          <Text style={styles.legendText}>Today</Text>
        </View>
      </View>
    </View>
  );
}